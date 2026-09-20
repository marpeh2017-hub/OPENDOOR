/**
 * Field encryption unit/e2e tests
 *
 * Run with: npx jest test/encryption.e2e-spec.ts --config jest.config.js
 */

import { FieldEncryptionService } from '../src/crypto/field-encryption.service'

describe('FieldEncryptionService', () => {
  let service: FieldEncryptionService

  beforeAll(() => {
    // Ensure dev mode so no env key is required
    process.env.NODE_ENV = 'test'
    delete process.env.FIELD_ENCRYPTION_KEY
    service = new FieldEncryptionService()
  })

  it('encrypt then decrypt returns original value', () => {
    const original = '123456789'
    const encrypted = service.encrypt(original)!
    const decrypted = service.decrypt(encrypted)
    expect(decrypted).toBe(original)
  })

  it('encrypted value does not equal plaintext', () => {
    const original = '123456789'
    const encrypted = service.encrypt(original)!
    expect(encrypted).not.toBe(original)
  })

  it("encrypted value starts with 'enc:v1:'", () => {
    const encrypted = service.encrypt('test-value')!
    expect(encrypted.startsWith('enc:v1:')).toBe(true)
  })

  it('null input returns null on encrypt', () => {
    expect(service.encrypt(null)).toBeNull()
    expect(service.encrypt(undefined)).toBeNull()
  })

  it('null input returns null on decrypt', () => {
    expect(service.decrypt(null)).toBeNull()
    expect(service.decrypt(undefined)).toBeNull()
  })

  it('tampered auth tag throws on decrypt', () => {
    const encrypted = service.encrypt('sensitive-data')!
    // Corrupt the tag segment (index 3 in 'enc:v1:<iv>:<tag>:<ct>')
    const parts = encrypted.split(':')
    parts[3] = Buffer.from('corruptedtag!!!!').toString('base64')
    const tampered = parts.join(':')

    expect(() => service.decrypt(tampered)).toThrow()
  })

  it('isEncrypted returns true for encrypted value', () => {
    const encrypted = service.encrypt('value')!
    expect(service.isEncrypted(encrypted)).toBe(true)
  })

  it('isEncrypted returns false for plaintext', () => {
    expect(service.isEncrypted('plaintext')).toBe(false)
    expect(service.isEncrypted(null)).toBe(false)
  })

  it('each encryption of same value produces different ciphertext (IV randomness)', () => {
    const enc1 = service.encrypt('same-value')!
    const enc2 = service.encrypt('same-value')!
    expect(enc1).not.toBe(enc2) // different IVs
    // But both decrypt correctly
    expect(service.decrypt(enc1)).toBe('same-value')
    expect(service.decrypt(enc2)).toBe('same-value')
  })
})
