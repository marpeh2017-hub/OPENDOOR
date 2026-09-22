/**
 * Public lead-capture E2E.
 *
 * This endpoint is the system's first and only unauthenticated write, so this
 * suite is written as an attack surface review rather than a happy-path check.
 * It pins, specifically:
 *
 *   - the endpoint accepts NO token and still works;
 *   - a client-supplied `tenantId` cannot influence where the lead lands;
 *   - the honeypot and minimum-time-on-form checks discard silently, with a
 *     response byte-identical to a successful submission;
 *   - per-IP rate limiting actually engages;
 *   - the response never leaks an id, a count, or whether an email is known;
 *   - the lead is attributed to `LeadSource.WEBSITE` and audited.
 *
 * Every row this suite creates is named with a run-unique marker and deleted in
 * afterAll — 24 suites share one dev database and run in parallel, so no
 * assertion here may depend on a global count.
 */
import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common'
import { randomUUID } from 'crypto'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/prisma.service'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-for-e2e'
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:')) {
  process.env.DATABASE_URL =
    'postgresql://postgres:postgres@127.0.0.1:5432/urban_renewal_os?schema=public'
}

const DEST_SLUG = 'e2e-public-lead-dest'
const DECOY_SLUG = 'e2e-public-lead-decoy'

/** Run-unique marker so every assertion is scoped to THIS run's rows. */
const RUN = randomUUID().slice(0, 8)
const email = (n: string) => `pl-${RUN}-${n}@e2e.local`

const ENDPOINT = '/api/v1/public/leads'

describe('Public lead capture (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let destTenantId: string
  let decoyTenantId: string

  /** A submission old enough to clear the minimum-time-on-form check. */
  const renderedAt = () => new Date(Date.now() - 30_000).toISOString()

  const validBody = (n: string) => ({
    kind: 'ELIGIBILITY',
    submissionId: randomUUID(),
    fullName: 'ישראל ישראלי',
    email: email(n),
    phone: '050-1234567',
    address: 'רחוב הבדיקה 12',
    city: 'תל אביב',
    estimatedUnits: 24,
    leadType: 'OWNER',
    projectType: 'PINUY_BINUY',
    organizingStatus: 'EARLY_CONVERSATION',
    message: `בדיקת E2E ${RUN}`,
    consentContact: true,
    consentPrivacy: true,
    privacyPolicyVersion: '2026-09-08',
    sourcePage: '/he/eligibility',
    locale: 'he',
    submittedAt: new Date().toISOString(),
    renderedAt: renderedAt(),
    utmSource: 'e2e',
    utmMedium: 'test',
    utmCampaign: 'public-leads',
  })

  /**
   * Requests from a distinct source IP.
   *
   * The rate limiter keys on IP, so without this every test in the file would
   * share one bucket and the ordering of tests would decide which ones pass.
   */
  const post = (body: unknown, ip = `10.0.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`) =>
    request(app.getHttpServer()).post(ENDPOINT).set('X-Forwarded-For', ip).send(body as object)

  const purge = async (slug: string) => {
    const t = await prisma.tenant.findUnique({ where: { slug } })
    if (!t) return
    const leads = await prisma.lead.findMany({ where: { tenantId: t.id }, select: { id: true } })
    await prisma.leadActivity.deleteMany({ where: { leadId: { in: leads.map((l) => l.id) } } })
    await prisma.lead.deleteMany({ where: { tenantId: t.id } })
    await prisma.auditLog.deleteMany({ where: { tenantId: t.id } })
    await prisma.tenant.delete({ where: { id: t.id } })
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication({ rawBody: true })
    // Trust one proxy hop so ThrottlerGuard buckets on X-Forwarded-For, exactly
    // as a deployment behind a load balancer must (TRUST_PROXY in main.ts).
    // Without this every test in the file shares one rate-limit bucket and the
    // order of the tests decides which ones pass.
    app.getHttpAdapter().getInstance().set('trust proxy', 1)
    app.setGlobalPrefix('api')
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })
    // Mirrors main.ts. forbidNonWhitelisted is the allow-list enforcement that
    // several assertions below depend on.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    )
    await app.init()

    prisma = app.get(PrismaService, { strict: false })

    await purge(DEST_SLUG)
    await purge(DECOY_SLUG)

    const dest = await prisma.tenant.create({
      data: { name: 'E2E Public Lead Destination', slug: DEST_SLUG },
    })
    destTenantId = dest.id

    // A second tenant that the endpoint must never write into, no matter what
    // the client sends.
    const decoy = await prisma.tenant.create({
      data: { name: 'E2E Public Lead Decoy', slug: DECOY_SLUG },
    })
    decoyTenantId = decoy.id

    // Point the endpoint at the destination tenant via configuration, which is
    // the only channel it reads.
    process.env.PUBLIC_LEAD_TENANT_ID = destTenantId
    delete process.env.PUBLIC_LEAD_TENANT_SLUG
  })

  afterAll(async () => {
    await purge(DEST_SLUG)
    await purge(DECOY_SLUG)
    await app?.close()
  })

  const findLead = (n: string) =>
    prisma.lead.findFirst({ where: { email: email(n) } })

  // ───────────────────────── happy path ─────────────────────────────────
  describe('accepting a genuine submission', () => {
    it('creates a lead with no authentication at all', async () => {
      const res = await post(validBody('ok'))

      expect(res.status).toBe(200)
      expect(res.body).toEqual({
        success: true,
        message: expect.any(String),
      })

      const lead = await findLead('ok')
      expect(lead).not.toBeNull()
      expect(lead).toMatchObject({
        tenantId: destTenantId,
        firstName: 'ישראל',
        lastName: 'ישראלי',
        city: 'תל אביב',
        address: 'רחוב הבדיקה 12',
        estimatedUnits: 24,
        leadType: 'OWNER',
        projectType: 'PINUY_BINUY',
        organizingStatus: 'EARLY_CONVERSATION',
        consentContact: true,
        consentPrivacy: true,
        utmSource: 'e2e',
        utmMedium: 'test',
        utmCampaign: 'public-leads',
        // LeadStatus spells the won state SIGNED, not WON; a new lead is NEW.
        status: 'NEW',
        // Source attribution, server-decided.
        source: 'WEBSITE',
      })
    })

    it('records source attribution on the lead timeline', async () => {
      const lead = await findLead('ok')
      const activities = await prisma.leadActivity.findMany({ where: { leadId: lead!.id } })
      expect(activities.length).toBeGreaterThan(0)
      expect(activities.some((a) => a.type === 'public_form_submission')).toBe(true)
      // No authenticated user exists, so the activity is unattributed rather
      // than falsely credited to a staff member.
      expect(activities.every((a) => a.createdById === null)).toBe(true)
    })

    it('audits the creation against the destination tenant with no user', async () => {
      const lead = await findLead('ok')
      const rows = await prisma.auditLog.findMany({
        where: { tenantId: destTenantId, entity: 'Lead', entityId: lead!.id },
      })
      expect(rows.length).toBeGreaterThan(0)
      // userId is a foreign key; an anonymous submission must be null, never a
      // borrowed or fabricated id.
      expect(rows.every((r) => r.userId === null)).toBe(true)
      expect(JSON.stringify(rows[0].metadata)).toContain('WEBSITE')
    })

    it('accepts a minimal submission without the optional fields', async () => {
      const res = await post({
        kind: 'CONTACT',
        submissionId: randomUUID(),
        fullName: 'דנה כהן',
        phone: '050-7654321',
        message: 'אשמח שתחזרו אליי',
        consentContact: true,
        consentPrivacy: true,
        privacyPolicyVersion: '2026-09-08',
        sourcePage: '/he/contact',
        locale: 'he',
        submittedAt: new Date().toISOString(),
        renderedAt: renderedAt(),
      })
      expect(res.status).toBe(200)
      const lead = await prisma.lead.findFirst({
        where: { tenantId: destTenantId, phone: '0507654321' },
      })
      expect(lead).not.toBeNull()
      expect(lead!.email).toBeNull()
      expect(lead!.tenantId).toBe(destTenantId)
      expect(lead!.formType).toBe('CONTACT')
    })
  })

  // ───────────────────── tenant assignment ──────────────────────────────
  describe('tenant assignment', () => {
    it('ignores a client-supplied tenantId — and rejects it as an unknown field', async () => {
      // The DTO has no tenantId, and forbidNonWhitelisted turns an attempt to
      // supply one into a 400 rather than a silent drop. Either way nothing is
      // written into the tenant the attacker named.
      const res = await post({ ...validBody('tenant-inject'), tenantId: decoyTenantId })
      expect(res.status).toBe(400)

      const inDecoy = await prisma.lead.count({ where: { tenantId: decoyTenantId } })
      expect(inDecoy).toBe(0)
      expect(await findLead('tenant-inject')).toBeNull()
    })

    it('never writes into a tenant other than the configured destination', async () => {
      await post(validBody('dest-only'))
      const lead = await findLead('dest-only')
      expect(lead!.tenantId).toBe(destTenantId)
      expect(await prisma.lead.count({ where: { tenantId: decoyTenantId } })).toBe(0)
    })
  })

  // ─────────────────────── input validation ─────────────────────────────
  describe('validation', () => {
    it('rejects a missing required field', async () => {
      const body = validBody('no-name')
      const { fullName: _fullName, ...missingName } = body
      const res = await post(missingName)
      expect(res.status).toBe(400)
      expect(await findLead('no-name')).toBeNull()
    })

    it('rejects a malformed email', async () => {
      const res = await post({ ...validBody('bad-email'), email: 'not-an-email' })
      expect(res.status).toBe(400)
    })

    it('rejects an implausible phone number', async () => {
      const res = await post({ ...validBody('bad-phone'), phone: '12' })
      expect(res.status).toBe(400)
      expect(await findLead('bad-phone')).toBeNull()
    })

    it('requires a building address and city for an eligibility enquiry', async () => {
      const body = validBody('no-address')
      const { address: _address, city: _city, ...missingLocation } = body
      const res = await post(missingLocation)
      expect(res.status).toBe(400)
      expect(await findLead('no-address')).toBeNull()
    })

    it('requires both contact and privacy consent', async () => {
      const withoutContact = await post({
        ...validBody('no-contact-consent'), consentContact: false,
      })
      const withoutPrivacy = await post({
        ...validBody('no-privacy-consent'), consentPrivacy: false,
      })
      expect(withoutContact.status).toBe(400)
      expect(withoutPrivacy.status).toBe(400)
      expect(await findLead('no-contact-consent')).toBeNull()
      expect(await findLead('no-privacy-consent')).toBeNull()
    })

    it('rejects an over-length message', async () => {
      const res = await post({ ...validBody('long-msg'), message: 'x'.repeat(1001) })
      expect(res.status).toBe(400)
      expect(await findLead('long-msg')).toBeNull()
    })

    it('rejects server-decided fields the client must not set', async () => {
      for (const injected of [
        { status: 'SIGNED' },
        { source: 'REFERRAL' },
        { score: 100 },
        { assignedToId: 'someone' },
        { convertedToResidentId: 'someone' },
      ]) {
        const res = await post({ ...validBody(`inject-${Object.keys(injected)[0]}`), ...injected })
        expect(res.status).toBe(400)
      }
    })

    it('rejects an unknown project type', async () => {
      const res = await post({ ...validBody('bad-interest'), projectType: 'TAKEOVER' })
      expect(res.status).toBe(400)
    })
  })

  // ───────────────────────── spam mitigation ────────────────────────────
  describe('spam mitigation', () => {
    it('discards a honeypot submission with an indistinguishable response', async () => {
      const clean = await post(validBody('hp-control'))
      const trapped = await post({ ...validBody('hp-caught'), company: 'AcmeBots Ltd' })

      // Byte-identical: a spammer must not learn the honeypot exists.
      expect(trapped.status).toBe(clean.status)
      expect(trapped.body).toEqual(clean.body)

      // But nothing was written.
      expect(await findLead('hp-caught')).toBeNull()
      expect(await findLead('hp-control')).not.toBeNull()
    })

    it('audits a honeypot catch so an attack is visible to operators', async () => {
      const rows = await prisma.auditLog.findMany({
        where: { tenantId: destTenantId, entity: 'PublicLeadSubmission' },
      })
      expect(rows.length).toBeGreaterThan(0)
      expect(rows.some((r) => JSON.stringify(r.metadata).includes('HONEYPOT'))).toBe(true)
    })

    it('discards a submission returned faster than a human could type it', async () => {
      const res = await post({ ...validBody('too-fast'), renderedAt: new Date().toISOString() })
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(await findLead('too-fast')).toBeNull()
    })

    it('discards a submission carrying a stale render timestamp', async () => {
      const res = await post({
        ...validBody('stale'),
        renderedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      })
      expect(res.status).toBe(200)
      expect(await findLead('stale')).toBeNull()
    })

    it('rejects a malformed renderedAt rather than trusting it', async () => {
      const res = await post({ ...validBody('bad-ts'), renderedAt: 'yesterday' })
      expect(res.status).toBe(400)
    })
  })

  // ───────────────────────── rate limiting ──────────────────────────────
  describe('rate limiting', () => {
    it('throttles repeated submissions from one IP with 429', async () => {
      const ip = `10.99.${Math.floor(Math.random() * 200)}.7`
      const statuses: number[] = []

      // The configured ceiling is 5 per 10 minutes for a single IP.
      for (let i = 0; i < 8; i++) {
        const res = await post({ ...validBody(`rl-${i}`), email: email(`rl-${i}`) }, ip)
        statuses.push(res.status)
      }

      expect(statuses).toContain(429)
      // The early requests must still have succeeded — the limiter throttles,
      // it does not break the endpoint.
      expect(statuses[0]).toBe(200)

      // Nothing past the limit was written.
      const written = await prisma.lead.count({
        where: { tenantId: destTenantId, email: { startsWith: `pl-${RUN}-rl-` } },
      })
      expect(written).toBeLessThan(8)
    })
  })

  // ────────────────────── information disclosure ────────────────────────
  describe('response disclosure', () => {
    it('returns the same body for a first and a duplicate submission', async () => {
      const body = { ...validBody('dupe'), renderedAt: renderedAt() }
      const first = await post(body)
      const second = await post({ ...body, renderedAt: renderedAt() })

      expect(first.status).toBe(200)
      expect(second.status).toBe(200)
      // No "already exists" signal — the form must not be usable as an oracle
      // for whether a given person is in the CRM.
      expect(second.body).toEqual(first.body)
      expect(await prisma.lead.count({
        where: { tenantId: destTenantId, submissionId: body.submissionId },
      })).toBe(1)
    })

    it('never returns an id, a count, or any lead field', async () => {
      const res = await post(validBody('no-leak'))
      const body = JSON.stringify(res.body)

      expect(Object.keys(res.body).sort()).toEqual(['message', 'success'])
      expect(body).not.toContain('tenantId')
      expect(body).not.toContain('leadId')
      expect(body).not.toContain(destTenantId)

      const lead = await findLead('no-leak')
      expect(body).not.toContain(lead!.id)
    })
  })

  describe('duplicate review', () => {
    it('keeps a new enquiry but marks a similar contact for staff review', async () => {
      const firstBody = {
        ...validBody('possible-dupe-first'),
        phone: '052-7654321',
        address: 'רחוב ייחודי 88',
      }
      const secondBody = {
        ...validBody('possible-dupe-second'),
        phone: '052-7654321',
        address: 'רחוב אחר 2',
      }
      await post(firstBody)
      await post(secondBody)

      const first = await findLead('possible-dupe-first')
      const second = await findLead('possible-dupe-second')
      expect(first).not.toBeNull()
      expect(second).toMatchObject({ possibleDuplicateOfId: first!.id })
      expect(second!.tags).toContain('possible-duplicate')
    })
  })
})
