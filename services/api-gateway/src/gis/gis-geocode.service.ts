import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma.service'
import { AuditService, type AuditActor } from '../common/audit/audit.service'
import { GeocodingService } from './geocoding/geocoding.service'
import {
  isValidLatLng,
  parseStoredCoordinates,
  toJsonValue,
  type StoredCoordinates,
} from './coordinates'
import type { GeocodeFailureReason } from './geocoding/geocoding.types'

/**
 * Entity-level geocoding: which rows need coordinates, resolving them through
 * the provider abstraction, persisting the result with provenance, and letting
 * a human override a provider that got it wrong.
 *
 * Three rules hold everywhere in this file:
 *
 *   1. **Never fabricate.** A failure writes nothing. The entity keeps a null
 *      `coordinates` and is simply absent from the map. There is no fallback to
 *      a city centroid, no jitter, no "close enough".
 *   2. **Never geocode on a read path.** Resolution happens only when an admin
 *      explicitly runs a sweep, or a human sets a coordinate by hand. There is
 *      no background job, by design — an automatic sweep against a donated
 *      public service is exactly what the Nominatim usage policy forbids.
 *   3. **Everything is audited**, including the manual overrides, because a
 *      hand-entered coordinate is the one nobody else can retrace.
 */

export type GeoEntityKind = 'PROJECT' | 'COMPLEX' | 'BUILDING'

export const GEO_ENTITY_KINDS: GeoEntityKind[] = ['PROJECT', 'COMPLEX', 'BUILDING']

/** Hard ceiling per sweep. At 1 req/s a larger batch would be bulk geocoding. */
export const MAX_SWEEP_BATCH = 25
export const DEFAULT_SWEEP_BATCH = 10

export interface GeocodeCandidate {
  kind: GeoEntityKind
  id: string
  name: string
  address: string
  city: string | null
  projectId: string
}

export interface GeocodeEntityResult {
  kind: GeoEntityKind
  id: string
  name: string
  address: string
  city: string | null
  status: 'MATCHED' | 'FAILED'
  /** Present only on MATCHED. */
  coordinates?: { lat: number; lng: number }
  matchQuality?: string
  confidence?: number
  displayName?: string
  /** Present only on FAILED. */
  reason?: GeocodeFailureReason
  detail?: string
}

export interface GeocodeRunSummary {
  provider: string
  attribution: string
  /** Entities that had an address and no coordinates when the sweep started. */
  pending: number
  attempted: number
  matched: number
  failed: number
  /** Failure counts by reason — this is what tells an admin what to fix. */
  failuresByReason: Record<string, number>
  /**
   * True when the provider became unreachable or rate-limited mid-sweep and
   * the run stopped early. Nothing was written for the remainder.
   */
  stoppedEarly: boolean
  results: GeocodeEntityResult[]
}

@Injectable()
export class GisGeocodeService {
  private readonly logger = new Logger(GisGeocodeService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly geocoding: GeocodingService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Entities in this tenant that have an address but no usable coordinates.
   *
   * Scoping follows the existing convention: Project by `tenantId` directly;
   * Complex and Building through the Project → Complex → Building chain, so a
   * caller can never reach another tenant's geometry.
   */
  async findCandidates(
    tenantId: string,
    filters: { kinds?: GeoEntityKind[]; projectId?: string; includeResolved?: boolean } = {},
  ): Promise<GeocodeCandidate[]> {
    const kinds = filters.kinds?.length ? filters.kinds : GEO_ENTITY_KINDS
    const projects = await this.prisma.project.findMany({
      where: {
        tenantId,
        ...(filters.projectId ? { id: filters.projectId } : {}),
      },
      select: {
        id: true,
        name: true,
        city: true,
        address: true,
        coordinates: true,
        complexes: {
          select: {
            id: true,
            name: true,
            address: true,
            coordinates: true,
            buildings: {
              select: { id: true, address: true, city: true, coordinates: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    const out: GeocodeCandidate[] = []
    const needs = (coords: unknown) =>
      filters.includeResolved ? true : parseStoredCoordinates(coords) === null

    for (const p of projects) {
      if (kinds.includes('PROJECT') && p.address && needs(p.coordinates)) {
        out.push({
          kind: 'PROJECT', id: p.id, name: p.name,
          address: p.address, city: p.city, projectId: p.id,
        })
      }
      for (const c of p.complexes) {
        if (kinds.includes('COMPLEX') && c.address && needs(c.coordinates)) {
          out.push({
            kind: 'COMPLEX', id: c.id, name: c.name,
            // A complex has no city of its own; it inherits the project's.
            address: c.address, city: p.city, projectId: p.id,
          })
        }
        for (const b of c.buildings) {
          if (kinds.includes('BUILDING') && b.address && needs(b.coordinates)) {
            out.push({
              kind: 'BUILDING', id: b.id, name: b.address,
              address: b.address, city: b.city ?? p.city, projectId: p.id,
            })
          }
        }
      }
    }
    return out
  }

  /**
   * Admin-triggered sweep over entities that are missing coordinates.
   *
   * Sequential by construction — the provider serialises to 1 req/s anyway, and
   * running this concurrently would only queue up behind the same gate while
   * making the failure reporting harder to follow. Stops immediately on a
   * transport-level fault so a provider outage costs one request, not `limit`.
   */
  async runSweep(
    actor: AuditActor,
    options: {
      kinds?: GeoEntityKind[]
      projectId?: string
      limit?: number
      /** Re-ask the provider even for entities that already have coordinates. */
      force?: boolean
    } = {},
  ): Promise<GeocodeRunSummary> {
    const limit = Math.min(options.limit ?? DEFAULT_SWEEP_BATCH, MAX_SWEEP_BATCH)
    const candidates = await this.findCandidates(actor.tenantId, {
      kinds: options.kinds,
      projectId: options.projectId,
      includeResolved: options.force,
    })

    const batch = candidates.slice(0, limit)
    const results: GeocodeEntityResult[] = []
    const failuresByReason: Record<string, number> = {}
    let matched = 0
    let stoppedEarly = false

    for (const candidate of batch) {
      const outcome = await this.geocoding.geocode(
        { address: candidate.address, city: candidate.city },
        { skipCache: options.force },
      )

      if (outcome.status === 'MATCHED') {
        const stored: StoredCoordinates = {
          lat: outcome.hit.lat,
          lng: outcome.hit.lng,
          source: 'GEOCODED',
          provider: outcome.hit.provider,
          resolvedAt: new Date().toISOString(),
          matchQuality: outcome.hit.matchQuality,
          confidence: outcome.hit.confidence,
          displayName: outcome.hit.displayName,
          query: outcome.hit.query,
        }
        await this.#persist(candidate.kind, candidate.id, stored)
        await this.audit.record(actor, {
          action: 'UPDATE',
          entity: entityName(candidate.kind),
          entityId: candidate.id,
          changes: { before: { coordinates: null }, after: { coordinates: stored } },
          metadata: {
            operation: 'geocode',
            provider: outcome.hit.provider,
            matchQuality: outcome.hit.matchQuality,
            confidence: outcome.hit.confidence,
          },
        })
        matched++
        results.push({
          kind: candidate.kind, id: candidate.id, name: candidate.name,
          address: candidate.address, city: candidate.city,
          status: 'MATCHED',
          coordinates: { lat: outcome.hit.lat, lng: outcome.hit.lng },
          matchQuality: outcome.hit.matchQuality,
          confidence: outcome.hit.confidence,
          displayName: outcome.hit.displayName,
        })
        continue
      }

      failuresByReason[outcome.reason] = (failuresByReason[outcome.reason] ?? 0) + 1
      results.push({
        kind: candidate.kind, id: candidate.id, name: candidate.name,
        address: candidate.address, city: candidate.city,
        status: 'FAILED', reason: outcome.reason, detail: outcome.detail,
      })

      // Graceful degradation: the service is down or has asked us to stop.
      // Abandon the rest of the batch rather than burning through it.
      if (outcome.reason === 'PROVIDER_UNAVAILABLE' || outcome.reason === 'RATE_LIMITED') {
        stoppedEarly = true
        this.logger.warn(`Geocode sweep stopped early: ${outcome.reason}`)
        break
      }
    }

    // The run itself is auditable even when it wrote nothing — "an admin asked
    // and the answer was no" is information.
    await this.audit.record(actor, {
      action: 'UPDATE',
      entity: 'GisGeocodeRun',
      entityId: null,
      metadata: {
        provider: this.geocoding.providerId,
        pending: candidates.length,
        attempted: results.length,
        matched,
        failed: results.length - matched,
        failuresByReason,
        stoppedEarly,
      },
    })

    return {
      provider: this.geocoding.providerId,
      attribution: this.geocoding.attribution,
      pending: candidates.length,
      attempted: results.length,
      matched,
      failed: results.length - matched,
      failuresByReason,
      stoppedEarly,
      results,
    }
  }

  /**
   * Manual coordinate override.
   *
   * The escape hatch that makes the whole feature usable in Israel, where OSM
   * street-name coverage is uneven and a provider will sometimes be confidently
   * wrong. A manual value is marked `source: 'MANUAL'` and records who set it,
   * so it is never mistaken for provider output and a later sweep can leave it
   * alone.
   */
  async setManualCoordinates(
    actor: AuditActor,
    kind: GeoEntityKind,
    id: string,
    input: { lat: number; lng: number; note?: string },
  ): Promise<StoredCoordinates> {
    if (!isValidLatLng(input.lat, input.lng)) {
      throw new BadRequestException('קואורדינטות לא תקינות')
    }

    const before = await this.#loadScoped(actor.tenantId, kind, id)

    const stored: StoredCoordinates = {
      lat: input.lat,
      lng: input.lng,
      source: 'MANUAL',
      provider: 'manual',
      resolvedAt: new Date().toISOString(),
      matchQuality: 'HOUSE_NUMBER',
      setByUserId: actor.userId,
      ...(input.note ? { note: input.note } : {}),
    }

    await this.#persist(kind, id, stored)
    await this.audit.record(actor, {
      action: 'UPDATE',
      entity: entityName(kind),
      entityId: id,
      changes: { before: { coordinates: before.coordinates }, after: { coordinates: stored } },
      metadata: { operation: 'manual-coordinate-override' },
    })

    // A human has corrected the address's location; drop any cached provider
    // answer so a future sweep on the same address is not stale.
    if (before.address) {
      await this.geocoding.invalidate({ address: before.address, city: before.city })
    }

    return stored
  }

  /** Clears a coordinate — the entity returns to being honestly unplaced. */
  async clearCoordinates(actor: AuditActor, kind: GeoEntityKind, id: string): Promise<void> {
    const before = await this.#loadScoped(actor.tenantId, kind, id)
    await this.#persist(kind, id, null)
    await this.audit.record(actor, {
      action: 'UPDATE',
      entity: entityName(kind),
      entityId: id,
      changes: { before: { coordinates: before.coordinates }, after: { coordinates: null } },
      metadata: { operation: 'clear-coordinates' },
    })
  }

  /**
   * Loads one entity with tenant scoping enforced through the ownership chain.
   * A miss is a 404 — cross-tenant access must be indistinguishable from
   * "does not exist", per the established convention.
   */
  async #loadScoped(
    tenantId: string,
    kind: GeoEntityKind,
    id: string,
  ): Promise<{ coordinates: unknown; address: string | null; city: string | null }> {
    if (kind === 'PROJECT') {
      const row = await this.prisma.project.findFirst({
        where: { id, tenantId },
        select: { coordinates: true, address: true, city: true },
      })
      if (!row) throw new NotFoundException(`פרויקט ${id} לא נמצא`)
      return row
    }
    if (kind === 'COMPLEX') {
      const row = await this.prisma.complex.findFirst({
        where: { id, project: { tenantId } },
        select: { coordinates: true, address: true, project: { select: { city: true } } },
      })
      if (!row) throw new NotFoundException(`מתחם ${id} לא נמצא`)
      return { coordinates: row.coordinates, address: row.address, city: row.project.city }
    }
    const row = await this.prisma.building.findFirst({
      where: { id, complex: { project: { tenantId } } },
      select: {
        coordinates: true,
        address: true,
        city: true,
        complex: { select: { project: { select: { city: true } } } },
      },
    })
    if (!row) throw new NotFoundException(`מבנה ${id} לא נמצא`)
    return {
      coordinates: row.coordinates,
      address: row.address,
      city: row.city ?? row.complex.project.city,
    }
  }

  /**
   * Writes the column. Scoping is already established by the caller — the
   * sweep sourced its ids from a tenant-scoped query and the override path went
   * through `#loadScoped` — so this is a plain write by primary key.
   */
  async #persist(kind: GeoEntityKind, id: string, value: StoredCoordinates | null): Promise<void> {
    // `coordinates` is `Json?` (see packages/db/prisma/schema.postgres.prisma —
    // the SQLite-flavoured schema.prisma is the legacy variant). Clearing a
    // nullable Json column needs Prisma.DbNull; a bare `null` is a type error.
    const data = {
      coordinates: value ? (toJsonValue(value) as Prisma.InputJsonValue) : Prisma.DbNull,
    }
    if (kind === 'PROJECT') {
      await this.prisma.project.update({ where: { id }, data })
      return
    }
    if (kind === 'COMPLEX') {
      await this.prisma.complex.update({ where: { id }, data })
      return
    }
    await this.prisma.building.update({ where: { id }, data })
  }
}

/** Prisma model name for the audit row — audit `entity` is the MODEL name. */
function entityName(kind: GeoEntityKind): string {
  return kind === 'PROJECT' ? 'Project' : kind === 'COMPLEX' ? 'Complex' : 'Building'
}
