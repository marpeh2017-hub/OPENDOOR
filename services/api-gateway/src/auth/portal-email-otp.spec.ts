/**
 * Resident portal sign-in by email (PortalAuthService, "EMAIL: THE SAME THREE
 * STEPS"), and the phone door it now shares its code checks with.
 *
 * In-memory stand-ins for Redis, the identity lookup and both senders. What is
 * held in place: a code goes only to an address on file, under the same answer
 * either way; one budget per address however it is typed; five guesses and
 * single use; the file decided as for a phone, including the selection step;
 * and the phone door unchanged by the shared helpers.
 */
import { BadRequestException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common'
import { PortalAuthService } from './portal-auth.service'
import type { ResidentContext } from './resident-identity.service'

const ctx = (residentId: string, apartmentNumber = '4'): ResidentContext => ({
  residentId, tenantId: 'tnt_01', tenantSlug: 'opendoor-demo', projectId: 'prj_1',
  projectName: 'מתחם הדקל', buildingId: 'bld_1', buildingAddress: 'הדקל 12',
  apartmentId: `apt_${apartmentNumber}`, apartmentNumber, residentName: 'רחל לוי',
})

function memoryRedis() {
  const data = new Map<string, string>()
  return {
    data,
    get: async (k: string) => data.get(k) ?? null,
    setex: async (k: string, _ttl: number, v: string) => { data.set(k, v) },
    del: async (...keys: string[]) => { keys.forEach((k) => data.delete(k)); return keys.length },
    incr: async (k: string) => { const v = Number(data.get(k) ?? 0) + 1; data.set(k, String(v)); return v },
    expire: async () => 1,
  }
}

function setup(files: Record<string, ResidentContext[]> = {}) {
  const redis = memoryRedis()
  const emails: { email: string; code: string }[] = []
  const texts: { phone: string; code: string }[] = []
  const lookups: string[] = []
  let ready = true
  const identity = {
    resolveByEmail: async (email: string) => { lookups.push(email); return { contexts: files[email] ?? [] } },
    resolveByPhone: async (phone: string) => ({ contexts: files[phone] ?? [] }),
    contextForResident: async (id: string) => Object.values(files).flat().find((c) => c.residentId === id) ?? null,
  }
  const emailOtp = {
    assertReady: () => {
      if (!ready) throw new ServiceUnavailableException({ code: 'EMAIL_UNAVAILABLE', message: 'x' })
    },
    send: async (email: string, code: string) => { emails.push({ email, code }) },
  }
  const sms = { sendOtp: async (phone: string, code: string) => { texts.push({ phone, code }) } }
  const jwt = { sign: () => 'signed.jwt' }
  const service = new PortalAuthService(identity as never, jwt as never, sms as never, redis, emailOtp as never)
  return { service, redis, emails, texts, lookups, setReady: (r: boolean) => { ready = r } }
}

const ANSWER = { message: 'אם הכתובת רשומה אצלנו, שלחנו אליה קוד.', expiresIn: 300 }

// The OTP hash is peppered with JWT_SECRET (common/otp/otp.ts).
const ORIGINAL_SECRET = process.env.JWT_SECRET
beforeAll(() => { process.env.JWT_SECRET = 'portal-email-otp-spec-secret' })
afterAll(() => { process.env.JWT_SECRET = ORIGINAL_SECRET })

describe('sendEmailOtp', () => {
  it('emails a code to an address on file, and stores only its hash', async () => {
    const { service, redis, emails } = setup({ 'rachel@example.com': [ctx('res_1')] })
    await expect(service.sendEmailOtp('rachel@example.com')).resolves.toEqual(ANSWER)
    expect(emails).toHaveLength(1)
    expect(emails[0]!.code).toMatch(/^\d{6}$/)
    const stored = redis.data.get('otp:email:rachel@example.com')
    expect(stored).toBeDefined()
    expect(stored).not.toContain(emails[0]!.code)
  })

  it('answers the same for an address nobody holds, and sends nothing', async () => {
    const { service, emails } = setup()
    await expect(service.sendEmailOtp('stranger@example.com')).resolves.toEqual(ANSWER)
    expect(emails).toHaveLength(0)
  })

  it('keeps one budget per address however it is typed, and spends it on unknown ones too', async () => {
    const { service, lookups } = setup({ 'rachel@example.com': [ctx('res_1')] })
    await service.sendEmailOtp(' Rachel@Example.COM ')
    await service.sendEmailOtp('rachel@example.com')
    await service.sendEmailOtp('RACHEL@example.com')
    expect(lookups).toEqual(['rachel@example.com', 'rachel@example.com', 'rachel@example.com'])
    await expect(service.sendEmailOtp('rachel@example.com')).rejects.toBeInstanceOf(BadRequestException)

    const other = setup()
    for (let i = 0; i < 3; i++) await other.service.sendEmailOtp('stranger@example.com')
    await expect(other.service.sendEmailOtp('stranger@example.com')).rejects.toBeInstanceOf(BadRequestException)
  })

  it('refuses before the lookup when no email can be sent', async () => {
    const { service, lookups, setReady } = setup({ 'rachel@example.com': [ctx('res_1')] })
    setReady(false)
    await expect(service.sendEmailOtp('rachel@example.com')).rejects.toBeInstanceOf(ServiceUnavailableException)
    expect(lookups).toHaveLength(0)
  })
})

describe('verifyEmailOtp', () => {
  it('opens the one file the address holds, once', async () => {
    const { service, emails } = setup({ 'rachel@example.com': [ctx('res_1')] })
    await service.sendEmailOtp('rachel@example.com')
    const code = emails[0]!.code
    await expect(service.verifyEmailOtp({ email: 'Rachel@Example.com', code }))
      .resolves.toMatchObject({ accessToken: 'signed.jwt', resident: { id: 'res_1' } })
    await expect(service.verifyEmailOtp({ email: 'rachel@example.com', code }))
      .rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('allows five wrong guesses, then the code is gone', async () => {
    const { service, emails } = setup({ 'rachel@example.com': [ctx('res_1')] })
    await service.sendEmailOtp('rachel@example.com')
    const code = emails[0]!.code
    const wrong = code === '000000' ? '111111' : '000000'
    for (let i = 0; i < 4; i++) {
      await expect(service.verifyEmailOtp({ email: 'rachel@example.com', code: wrong }))
        .rejects.toMatchObject({ response: { code: 'OTP_INVALID' } })
    }
    await expect(service.verifyEmailOtp({ email: 'rachel@example.com', code: wrong }))
      .rejects.toMatchObject({ response: { code: 'OTP_ATTEMPTS_EXCEEDED' } })
    await expect(service.verifyEmailOtp({ email: 'rachel@example.com', code }))
      .rejects.toMatchObject({ response: { code: 'OTP_INVALID' } })
  })

  it('lets the person choose between their own files, and only among those offered', async () => {
    const { service, emails } = setup({ 'couple@example.com': [ctx('res_1', '4'), ctx('res_2', '9')] })
    await service.sendEmailOtp('couple@example.com')
    const challenge = await service.verifyEmailOtp({ email: 'couple@example.com', code: emails[0]!.code })
    expect(challenge).toMatchObject({ selectionRequired: true })
    const { selectionToken, options } = challenge as { selectionToken: string; options: { residentId: string }[] }
    expect(options.map((o) => o.residentId)).toEqual(['res_1', 'res_2'])

    await expect(service.completeSelection(selectionToken, 'res_999'))
      .rejects.toMatchObject({ response: { code: 'SELECTION_INVALID' } })
    await expect(service.completeSelection(selectionToken, 'res_2'))
      .resolves.toMatchObject({ resident: { id: 'res_2' } })
  })

  it('refuses when the file is gone by the time the code is typed', async () => {
    const files: Record<string, ResidentContext[]> = { 'rachel@example.com': [ctx('res_1')] }
    const { service, emails } = setup(files)
    await service.sendEmailOtp('rachel@example.com')
    files['rachel@example.com'] = []
    await expect(service.verifyEmailOtp({ email: 'rachel@example.com', code: emails[0]!.code }))
      .rejects.toMatchObject({ response: { code: 'RESIDENT_NOT_FOUND' } })
  })
})

describe('the phone door, through the shared helpers', () => {
  it('still sends, checks and spends a code the way it did', async () => {
    const { service, texts } = setup({ '0501234567': [ctx('res_1')] })
    await expect(service.sendOtp('0501234567')).resolves.toEqual({ message: 'קוד נשלח', expiresIn: 300 })
    const code = texts[0]!.code
    const wrong = code === '000000' ? '111111' : '000000'
    await expect(service.verifyOtp({ phone: '0501234567', code: wrong }))
      .rejects.toMatchObject({ response: { code: 'OTP_INVALID' } })
    await expect(service.verifyOtp({ phone: '0501234567', code }))
      .resolves.toMatchObject({ resident: { id: 'res_1' } })
    await expect(service.verifyOtp({ phone: '0501234567', code }))
      .rejects.toMatchObject({ response: { code: 'OTP_INVALID' } })
  })

  it('keeps its own budget of three sends an hour', async () => {
    const { service } = setup()
    for (let i = 0; i < 3; i++) await service.sendOtp('0501234567')
    await expect(service.sendOtp('0501234567')).rejects.toBeInstanceOf(BadRequestException)
  })
})
