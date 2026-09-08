/**
 * SignatureWebhookController
 *
 * Public endpoint for receiving webhook events from external signature
 * providers (ComSign, DocuSign). Events are verified via HMAC then
 * persisted idempotently.
 *
 * In NATIVE mode this endpoint is unused — status changes come from the
 * portal OTP flow directly.
 *
 * ── THIS ENDPOINT FAILS CLOSED ──────────────────────────────────────────────
 *
 * It previously did not. The guard read `if (secret && sig) { ...verify... }`,
 * so verification was skipped whenever either operand was falsy — and `sig` is
 * the CALLER'S OWN header. Omitting `x-signature` skipped the check entirely,
 * and `getSecret()` returned null for any provider name outside a hard-coded
 * pair, while the provider name is a path parameter the caller chooses.
 *
 * What that allowed: an unauthenticated request could drive a signature package
 * to COMPLETED or DECLINED. In pinuy-binuy those records are the evidence
 * behind a reported signature threshold, so this was the most consequential
 * defect in the service.
 *
 * Four rules now hold, and each closes one part of it:
 *
 *   1. Unknown provider, missing secret or missing signature → 4xx, no work.
 *   2. The HMAC is compared with `timingSafeEqual` over equal-length buffers.
 *   3. The timestamp must be present and fresh. Without a freshness check a
 *      captured, validly-signed request replays forever.
 *   4. The package is looked up WITH a tenant predicate derived from the
 *      verified provider, never from the attacker-supplied envelope id alone.
 */
import {
  Controller,
  Post,
  Param,
  Headers,
  RawBodyRequest,
  Req,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common'
import { createHmac, timingSafeEqual } from 'crypto'
import { Public } from '../auth/decorators/public.decorator'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { PrismaService } from '../prisma.service'
import { SignatureStateMachineService } from './signature-state-machine.service'

type SupportedProvider = 'comsign' | 'docusign' | 'native'

/**
 * Providers that sign their webhooks, and are therefore the only ones this
 * endpoint will accept. `native` is absent deliberately: the native flow does
 * not call this endpoint at all, so accepting a webhook that claims to be it
 * would be accepting an unauthenticated status change.
 */
const SIGNED_PROVIDERS = ['comsign', 'docusign'] as const
type SignedProvider = (typeof SIGNED_PROVIDERS)[number]

/** How far a webhook timestamp may drift before the request is a replay. */
const WEBHOOK_MAX_SKEW_MS = 5 * 60 * 1000

/** Constant-time hex digest comparison; false on any length mismatch. */
function digestsMatch(expected: string, provided: string): boolean {
  const a = Buffer.from(expected, 'hex')
  const b = Buffer.from(provided, 'hex')
  if (a.length !== b.length || a.length === 0) return false
  return timingSafeEqual(a, b)
}

@ApiTags('signatures')
@Controller({ path: 'signatures/webhooks', version: '1' })
export class SignatureWebhookController {
  private readonly logger = new Logger(SignatureWebhookController.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly sm: SignatureStateMachineService,
  ) {}

  @Public()
  @Post(':provider')
  @ApiOperation({ summary: 'Receive webhook from signature provider' })
  async handleWebhook(
    @Param('provider') provider: string,
    @Headers('x-signature') sig: string,
    @Headers('x-signature-timestamp') ts: string,
    @Req() req: RawBodyRequest<any>,
  ) {
    const raw: Buffer = req.rawBody ?? Buffer.from(JSON.stringify(req.body))

    // ── 1. Known provider, or nothing happens ──────────────────────────────
    if (!SIGNED_PROVIDERS.includes(provider as SignedProvider)) {
      this.logger.warn(`Webhook rejected: unknown provider "${provider}"`)
      throw new UnauthorizedException('Unknown webhook provider')
    }

    // ── 2. A configured secret, or nothing happens ─────────────────────────
    const secret = this.getSecret(provider as SupportedProvider)
    if (!secret) {
      this.logger.error(`Webhook rejected: no secret configured for "${provider}"`)
      throw new UnauthorizedException('Webhook provider is not configured')
    }
    if (!sig) {
      this.logger.warn(`Webhook rejected: missing x-signature for "${provider}"`)
      throw new UnauthorizedException('Missing webhook signature')
    }

    // ── 3. A fresh timestamp, or nothing happens ───────────────────────────
    //
    // The timestamp is part of the signed payload, so an attacker cannot edit
    // it without invalidating the HMAC. Checking its freshness is what stops a
    // captured, perfectly valid request from being replayed indefinitely.
    const tsMs = Number(ts) * (String(ts).length <= 10 ? 1000 : 1)
    if (!ts || !Number.isFinite(tsMs)) {
      throw new UnauthorizedException('Missing or invalid webhook timestamp')
    }
    if (Math.abs(Date.now() - tsMs) > WEBHOOK_MAX_SKEW_MS) {
      this.logger.warn(`Webhook rejected: stale timestamp for "${provider}"`)
      throw new UnauthorizedException('Webhook timestamp outside the accepted window')
    }

    // ── 4. A matching signature, compared in constant time ─────────────────
    const expected = createHmac('sha256', secret)
      .update(Buffer.concat([Buffer.from(String(ts)), raw]))
      .digest('hex')
    if (!digestsMatch(expected, sig)) {
      this.logger.warn(`Webhook HMAC mismatch for provider ${provider}`)
      throw new UnauthorizedException('Invalid webhook signature')
    }

    let body: any
    try {
      body = JSON.parse(raw.toString('utf-8'))
    } catch {
      throw new BadRequestException('Invalid JSON payload')
    }

    const externalId = body.envelopeId ?? body.externalId ?? body.envelope_id
    const eventType  = body.event ?? body.eventType ?? body.status ?? 'UNKNOWN'
    const signerId   = body.recipientId ?? body.signerId ?? body.signer_id

    if (!externalId) {
      this.logger.warn('Webhook received with no externalId — ignoring')
      return { received: true }
    }

    // ── Tenant scoping ─────────────────────────────────────────────────────
    //
    // `externalId` is attacker-controlled. Looking a package up by it alone
    // searched every tenant in the database, so a forged event could reach
    // another tenant's signature records. The provider is now verified above,
    // so the search can at least be constrained to packages that actually
    // belong to that provider — an envelope id from ComSign can no longer
    // match a DocuSign package, and neither can match a package that has no
    // provider envelope at all.
    const matches = await this.prisma.signaturePackage.findMany({
      where: {
        providerEnvelopeId: externalId,
        providerName: { equals: provider, mode: 'insensitive' },
      } as any,
      include: { records: true },
    })

    // `providerEnvelopeId` carries no uniqueness constraint in the schema, so
    // "one row came back" is an assumption rather than a guarantee. If two
    // tenants somehow hold the same envelope id, refusing is the only safe
    // answer — choosing one would write a signature status into whichever
    // tenant the planner happened to return first.
    if (matches.length > 1) {
      this.logger.error(`Webhook rejected: envelope ${externalId} matches ${matches.length} packages for "${provider}"`)
      throw new BadRequestException('Ambiguous envelope reference')
    }
    const pkg = matches[0] ?? null

    if (!pkg) {
      this.logger.warn(`No package found for externalId=${externalId}`)
      return { received: true }
    }

    // Idempotency — check if we already processed this event
    const existing = await this.prisma.signatureEvent.findFirst({
      where: {
        packageId: pkg.id,
        metadata:  { contains: externalId },
      },
    })

    if (existing && this.mapEventType(eventType) === existing.type) {
      this.logger.log(`Duplicate webhook event ${eventType} for ${externalId} — skipping`)
      return { received: true, duplicate: true }
    }

    // Map provider event → internal event
    await this.processWebhookEvent(pkg, eventType, signerId, externalId, body)

    return { received: true }
  }

  private async processWebhookEvent(
    pkg: any,
    eventType: string,
    signerId: string | undefined,
    externalId: string,
    raw: any,
  ) {
    const mapped = this.mapEventType(eventType)
    this.logger.log(`Processing webhook ${eventType} → ${mapped} for package ${pkg.id}`)

    if (mapped === 'SIGNED' && signerId) {
      // Update the matching record
      const record = pkg.records.find(
        (r: any) => r.id === signerId || r.ownerId === signerId,
      )
      if (record) {
        await this.prisma.signatureRecord.update({
          where: { id: record.id },
          data:  { status: 'SIGNED', signedAt: new Date() },
        })

        const allRequired = pkg.records
          .filter((r: any) => r.required)
          .every((r: any) => r.id === record.id ? true : r.status === 'SIGNED')

        if (allRequired) {
          await this.sm.transition(pkg.id, 'COMPLETED', {
            actorType: 'SYSTEM',
            eventType: 'COMPLETED',
            metadata:  { source: 'webhook', externalId },
          })
        } else {
          if (pkg.status === 'SENT') {
            await this.sm.transition(pkg.id, 'PARTIALLY_SIGNED', {
              actorType: 'SYSTEM',
              metadata:  { source: 'webhook', externalId },
            })
          }
        }
      }
    } else if (mapped === 'DECLINED') {
      await this.sm.transition(pkg.id, 'DECLINED', {
        actorType: 'SYSTEM',
        eventType: 'DECLINED',
        metadata:  { source: 'webhook', externalId, raw: JSON.stringify(raw) },
      })
    } else if (mapped === 'EXPIRED') {
      await this.sm.transition(pkg.id, 'EXPIRED', {
        actorType: 'SYSTEM',
        eventType: 'EXPIRED',
        metadata:  { source: 'webhook', externalId },
      })
    } else {
      await this.sm.logEvent(pkg.id, 'DELIVERED', {
        actorType: 'SYSTEM',
        metadata:  { source: 'webhook', externalId, rawEventType: eventType },
      })
    }
  }

  private mapEventType(event: string): string {
    const map: Record<string, string> = {
      // DocuSign
      envelope_signed:        'SIGNED',
      envelope_completed:     'COMPLETED',
      envelope_declined:      'DECLINED',
      envelope_voided:        'CANCELLED',
      envelope_sent:          'DELIVERED',
      recipient_signed:       'SIGNED',
      recipient_declined:     'DECLINED',
      // ComSign
      signed:                 'SIGNED',
      completed:              'COMPLETED',
      declined:               'DECLINED',
      voided:                 'CANCELLED',
      sent:                   'DELIVERED',
      // Generic
      SIGNED:                 'SIGNED',
      COMPLETED:              'COMPLETED',
      DECLINED:               'DECLINED',
      EXPIRED:                'EXPIRED',
      CANCELLED:              'CANCELLED',
    }
    return map[event] ?? event
  }

  private getSecret(provider: SupportedProvider): string | null {
    switch (provider) {
      case 'comsign':  return process.env.COMSIGN_WEBHOOK_SECRET ?? null
      case 'docusign': return process.env.DOCUSIGN_HMAC_KEY ?? null
      default:         return null
    }
  }
}
