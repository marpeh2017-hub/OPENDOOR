/**
 * Signature webhook HMAC verification (e2e)
 *
 * Why this suite exists: until now NO test built its app with `rawBody: true`,
 * so `req.rawBody` was always undefined and the controller fell back to
 * `Buffer.from(JSON.stringify(req.body))` — it verified the HMAC against a body
 * IT had re-serialized, not the bytes the provider signed. Every webhook test
 * therefore exercised the fallback and none exercised verification as it runs
 * in production, where `main.ts` sets `rawBody: true`.
 *
 * The decisive test below is `verifies against the bytes on the wire`: it signs
 * a payload whose key order and whitespace do not survive a JSON round-trip.
 * Under the fallback the recomputed digest differs and the request is rejected;
 * only reading the raw bytes accepts it. That is the case that distinguishes
 * the two code paths, so it is the one that proves the fix.
 */
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { createHmac } from 'crypto'
import request from 'supertest'

import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/prisma.service'

const SECRET = 'webhook-hmac-e2e-secret'
const TENANT_SLUG = 'webhook-hmac-e2e'
const ENVELOPE = 'webhook-hmac-e2e-envelope'

/** The signature the provider computes: HMAC-SHA256 over timestamp ‖ raw body. */
function sign(timestamp: string, raw: string): string {
  return createHmac('sha256', SECRET).update(Buffer.concat([Buffer.from(timestamp), Buffer.from(raw)])).digest('hex')
}

describe('Signature webhook HMAC (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let packageId: string | null = null
  let projectId: string | null = null

  beforeAll(async () => {
    process.env.COMSIGN_WEBHOOK_SECRET = SECRET

    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = mod.createNestApplication({ rawBody: true })
    app.setGlobalPrefix('api')
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }))
    await app.init()

    prisma = app.get(PrismaService)

    // A package the verified webhook can legitimately reach. Its absence would
    // make every assertion below pass for the wrong reason: an unmatched
    // envelope also returns `{ received: true }`.
    const tenant = await prisma.tenant.upsert({
      where:  { slug: TENANT_SLUG },
      update: {},
      create: { slug: TENANT_SLUG, name: 'Webhook HMAC e2e' },
    })
    const project = await prisma.project.create({
      data: {
        tenantId: tenant.id,
        code:     'WHM-001',
        name:     'Webhook HMAC e2e project',
        city:     'תל אביב',
      },
    })
    projectId = project.id
    const pkg = await prisma.signaturePackage.create({
      data: {
        tenantId:           tenant.id,
        projectId:          project.id,
        title:              'webhook-hmac-e2e package',
        status:             'SENT',
        providerEnvelopeId: ENVELOPE,
        providerName:       'comsign',
      } as any,
    })
    packageId = pkg.id
  })

  afterAll(async () => {
    if (packageId) {
      await prisma.signatureEvent.deleteMany({ where: { packageId } })
      await prisma.signaturePackage.deleteMany({ where: { id: packageId } })
    }
    if (projectId) await prisma.project.deleteMany({ where: { id: projectId } })
    await prisma.tenant.deleteMany({ where: { slug: TENANT_SLUG } })
    await app?.close()
  })

  const ts = () => String(Date.now())

  it('accepts a correctly signed webhook', async () => {
    const raw = JSON.stringify({ envelopeId: ENVELOPE, event: 'envelope_delivered' })
    const timestamp = ts()

    const res = await request(app.getHttpServer())
      .post('/api/v1/signatures/webhooks/comsign')
      .set('Content-Type', 'application/json')
      .set('x-signature', sign(timestamp, raw))
      .set('x-signature-timestamp', timestamp)
      .send(raw)

    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ received: true })
  })

  it('verifies against the bytes on the wire, not a re-serialized body', async () => {
    // Key order and whitespace that `JSON.stringify(req.body)` cannot reproduce.
    const raw = '{  "event" : "envelope_delivered" ,\n  "envelopeId":"' + ENVELOPE + '"  }'
    expect(JSON.stringify(JSON.parse(raw))).not.toBe(raw) // the round-trip really does differ

    const timestamp = ts()
    const res = await request(app.getHttpServer())
      .post('/api/v1/signatures/webhooks/comsign')
      .set('Content-Type', 'application/json')
      .set('x-signature', sign(timestamp, raw))
      .set('x-signature-timestamp', timestamp)
      .send(raw)

    expect(res.status).toBe(201)
  })

  it('rejects a body altered after signing', async () => {
    const signed = JSON.stringify({ envelopeId: ENVELOPE, event: 'envelope_delivered' })
    const tampered = JSON.stringify({ envelopeId: ENVELOPE, event: 'envelope_signed' })
    const timestamp = ts()

    const res = await request(app.getHttpServer())
      .post('/api/v1/signatures/webhooks/comsign')
      .set('Content-Type', 'application/json')
      .set('x-signature', sign(timestamp, signed))
      .set('x-signature-timestamp', timestamp)
      .send(tampered)

    expect(res.status).toBe(401)
  })

  it('rejects a webhook with no signature at all', async () => {
    const raw = JSON.stringify({ envelopeId: ENVELOPE, event: 'envelope_delivered' })
    const timestamp = ts()

    const res = await request(app.getHttpServer())
      .post('/api/v1/signatures/webhooks/comsign')
      .set('Content-Type', 'application/json')
      .set('x-signature-timestamp', timestamp)
      .send(raw)

    expect(res.status).toBe(401)
  })

  it('rejects a validly signed webhook that is replayed after the window', async () => {
    const raw = JSON.stringify({ envelopeId: ENVELOPE, event: 'envelope_delivered' })
    const timestamp = String(Date.now() - 10 * 60 * 1000)

    const res = await request(app.getHttpServer())
      .post('/api/v1/signatures/webhooks/comsign')
      .set('Content-Type', 'application/json')
      .set('x-signature', sign(timestamp, raw))
      .set('x-signature-timestamp', timestamp)
      .send(raw)

    expect(res.status).toBe(401)
  })

  it('rejects a provider that signs nothing, however well-formed the request', async () => {
    const raw = JSON.stringify({ envelopeId: ENVELOPE, event: 'envelope_signed' })
    const timestamp = ts()

    const res = await request(app.getHttpServer())
      .post('/api/v1/signatures/webhooks/native')
      .set('Content-Type', 'application/json')
      .set('x-signature', sign(timestamp, raw))
      .set('x-signature-timestamp', timestamp)
      .send(raw)

    expect(res.status).toBe(401)
  })
})
