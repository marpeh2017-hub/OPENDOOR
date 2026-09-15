import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { parseStoredCoordinates, toLatLng, type LatLng, type StoredCoordinates } from './coordinates'

/**
 * GIS read model.
 *
 * The geographic layer is a *foundation*: `Project.coordinates`,
 * `Complex.coordinates` and `Building.coordinates` all exist in the schema as
 * `Json? // { lat, lng }`, but in practice they are still unpopulated. This
 * service therefore reports two things honestly:
 *
 *   1. `features` — only entities that genuinely have coordinates. Nothing is
 *      invented, defaulted, or jittered onto a map. An entity with an address
 *      but no coordinates is NOT emitted as a feature; it is counted as
 *      "geocodable" so the UI can explain what is missing.
 *   2. `coverage` — how much of the tenant's portfolio actually carries
 *      geometry, which is what the empty state renders.
 *
 * Tenant isolation follows the existing two-step convention: Project is scoped
 * directly by `tenantId`; Complex and Building are scoped through the
 * Project → Complex → Building ownership chain.
 */

export type { LatLng } from './coordinates'

export type GisFeatureKind = 'PROJECT' | 'COMPLEX' | 'BUILDING'

/** Coordinate provenance, projected from the stored value onto the wire. */
export interface GisFeatureProvenance {
  source: 'GEOCODED' | 'MANUAL' | 'UNKNOWN'
  provider: string | null
  resolvedAt: string | null
  matchQuality: string | null
  confidence: number | null
}

function provenanceOf(c: StoredCoordinates): GisFeatureProvenance {
  return {
    // Rows written before provenance existed report UNKNOWN rather than
    // claiming a source they cannot substantiate.
    source: c.source ?? 'UNKNOWN',
    provider: c.provider ?? null,
    resolvedAt: c.resolvedAt ?? null,
    matchQuality: c.matchQuality ?? null,
    confidence: typeof c.confidence === 'number' ? c.confidence : null,
  }
}

/**
 * One mappable entity.
 *
 * `metrics` is deliberately present-but-empty scaffolding. Health Score,
 * signature %, data-quality score and Next Best Action are all intended to be
 * surfaced per-feature on the map later; the shape is reserved here so adding
 * them is an additive change on both sides of the wire. Nothing populates it
 * today and the UI must treat every field as optional.
 */
export interface GisFeature {
  id: string
  kind: GisFeatureKind
  name: string
  address: string | null
  city: string | null
  coordinates: LatLng
  /**
   * Where this coordinate came from. Surfaced so a wrong marker on the map can
   * be traced to the provider and run that produced it, and so a hand-corrected
   * location is visibly distinct from a provider guess.
   */
  provenance: GisFeatureProvenance
  projectId: string
  projectName: string
  projectCode: string
  stage: string | null
  status: string | null
  /** Reserved for future per-feature overlays. Always `{}` for now. */
  metrics: {
    healthScore?: number
    signaturePercent?: number
    dataQualityScore?: number
    nextBestAction?: { code: string; label: string }
  }
}

export interface GisCoverage {
  /** Entities of this kind that exist for the tenant. */
  total: number
  /** Entities that have usable `{ lat, lng }` coordinates. */
  withCoordinates: number
  /** Entities with an address but no coordinates — candidates for geocoding. */
  geocodable: number
}

export interface GisOverview {
  features: GisFeature[]
  coverage: {
    projects: GisCoverage
    complexes: GisCoverage
    buildings: GisCoverage
  }
  /** True when there is not a single coordinate anywhere for this tenant. */
  hasAnyGeoData: boolean
  /** Cities present in the portfolio, for the filter control. */
  cities: string[]
}

/**
 * Reads the `coordinates` column.
 *
 * Delegates to the shared parser in `./coordinates`, which is also what the
 * geocoder writes through. Two things matter here: the column is `String?`
 * holding JSON (an earlier local parser only handled already-parsed objects
 * and so silently treated every stored coordinate as absent), and provenance
 * keys travel alongside the pair rather than in separate columns.
 */
function readCoordinates(value: unknown): StoredCoordinates | null {
  return parseStoredCoordinates(value)
}

@Injectable()
export class GisService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(
    tenantId: string,
    filters: { projectId?: string; city?: string; search?: string } = {},
  ): Promise<GisOverview> {
    const { projectId, city, search } = filters

    // Project → Complex → Building is fetched in a single nested read so the
    // whole map layer costs one query rather than one per level.
    const projects = await this.prisma.project.findMany({
      where: {
        tenantId,
        ...(projectId ? { id: projectId } : {}),
        ...(city ? { city } : {}),
      },
      select: {
        id: true,
        code: true,
        name: true,
        city: true,
        address: true,
        stage: true,
        status: true,
        coordinates: true,
        complexes: {
          select: {
            id: true,
            name: true,
            address: true,
            status: true,
            coordinates: true,
            buildings: {
              select: {
                id: true,
                address: true,
                city: true,
                status: true,
                coordinates: true,
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    const features: GisFeature[] = []
    const coverage = {
      projects:  { total: 0, withCoordinates: 0, geocodable: 0 },
      complexes: { total: 0, withCoordinates: 0, geocodable: 0 },
      buildings: { total: 0, withCoordinates: 0, geocodable: 0 },
    }
    const cities = new Set<string>()

    const matchesSearch = (...fields: (string | null | undefined)[]) => {
      if (!search) return true
      const needle = search.trim().toLowerCase()
      if (!needle) return true
      return fields.some((f) => f?.toLowerCase().includes(needle))
    }

    for (const p of projects) {
      if (p.city) cities.add(p.city)

      coverage.projects.total += 1
      const pCoords = readCoordinates(p.coordinates)
      if (pCoords) {
        coverage.projects.withCoordinates += 1
        if (matchesSearch(p.name, p.code, p.address, p.city)) {
          features.push({
            id: p.id,
            kind: 'PROJECT',
            name: p.name,
            address: p.address,
            city: p.city,
            coordinates: toLatLng(pCoords),
            provenance: provenanceOf(pCoords),
            projectId: p.id,
            projectName: p.name,
            projectCode: p.code,
            stage: p.stage,
            status: p.status,
            metrics: {},
          })
        }
      } else if (p.address) {
        coverage.projects.geocodable += 1
      }

      for (const c of p.complexes) {
        coverage.complexes.total += 1
        const cCoords = readCoordinates(c.coordinates)
        if (cCoords) {
          coverage.complexes.withCoordinates += 1
          if (matchesSearch(c.name, c.address, p.name, p.code)) {
            features.push({
              id: c.id,
              kind: 'COMPLEX',
              name: c.name,
              address: c.address,
              city: p.city,
              coordinates: toLatLng(cCoords),
              provenance: provenanceOf(cCoords),
              projectId: p.id,
              projectName: p.name,
              projectCode: p.code,
              stage: p.stage,
              status: c.status,
              metrics: {},
            })
          }
        } else if (c.address) {
          coverage.complexes.geocodable += 1
        }

        for (const b of c.buildings) {
          if (b.city) cities.add(b.city)
          coverage.buildings.total += 1
          const bCoords = readCoordinates(b.coordinates)
          if (bCoords) {
            coverage.buildings.withCoordinates += 1
            if (matchesSearch(b.address, b.city, p.name, p.code)) {
              features.push({
                id: b.id,
                kind: 'BUILDING',
                name: b.address,
                address: b.address,
                city: b.city ?? p.city,
                coordinates: toLatLng(bCoords),
              provenance: provenanceOf(bCoords),
                projectId: p.id,
                projectName: p.name,
                projectCode: p.code,
                stage: p.stage,
                status: b.status,
                metrics: {},
              })
            }
          } else if (b.address) {
            coverage.buildings.geocodable += 1
          }
        }
      }
    }

    return {
      features,
      coverage,
      hasAnyGeoData:
        coverage.projects.withCoordinates +
          coverage.complexes.withCoordinates +
          coverage.buildings.withCoordinates >
        0,
      cities: [...cities].sort((a, b) => a.localeCompare(b, 'he')),
    }
  }
}
