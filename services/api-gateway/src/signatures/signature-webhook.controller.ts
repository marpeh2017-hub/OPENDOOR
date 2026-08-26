/**
 * SignatureWebhookController
 *
 * Public endpoint for receiving webhook events from external signature
 * providers (ComSign, DocuSign). Events are verified via HMAC then
 * persisted idempotently.
 *
 * In NATIVE mode this endpoint is unused — status changes come from the
 * portal OTP flow directly.
 */
import {
  Controller,
  Post,
  Param,
  Headers,
  RawBodyRequest,
  Req,
  BadRequestException,
  Logger,
} from '@nestjs/common'
import { createHmac } from 'crypto'
import { Public } from '../auth/decorators/public.decorator'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { PrismaService } from '../prisma.service'
import { SignatureStateMachineService } from './signature-state-machine.service'

type SupportedProvider = 'comsign' | 'docusign' | 'native'

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

    // Verify HMAC
    const secret = this.getSecret(provider as SupportedProvider)
    if (secret && sig) {
      const payload  = ts ? Buffer.concat([Buffer.from(ts), raw]) : raw
      const expected = createHmac('sha256', secret).update(payload).digest('hex')
      if (expected !== sig) {
        this.logger.warn(`Webhook HMAC mismatch for provider ${provider}`)
        throw new BadRequestException('Invalid webhook signature')
      }
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

    // Find the package by providerEnvelopeId
    const pkg = await this.prisma.signaturePackage.findFirst({
      where: { providerEnvelopeId: externalId } as any,
      include: { records: true },
    })

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
