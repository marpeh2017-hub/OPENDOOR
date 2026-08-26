import { Injectable, Logger } from '@nestjs/common'
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto'

/**
 * AES-256-GCM field-level encryption for PII (nationalId, bankAccount, etc.)
 * Key is derived from FIELD_ENCRYPTION_KEY env var (must be 32 bytes base64).
 * Never logs plaintext values.
 */
@Injectable()
export class FieldEncryptionService {
  private readonly logger = new Logger(FieldEncryptionService.name)
  private readonly key: Buffer

  constructor() {
    const keyB64 = process.env.FIELD_ENCRYPTION_KEY
    if (!keyB64) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('FIELD_ENCRYPTION_KEY environment variable is required in production')
      }
      // Dev fallback — deterministic but clearly labelled
      this.logger.warn('FIELD_ENCRYPTION_KEY not set — using insecure dev key. Set this env var in production.')
      this.key = createHash('sha256').update('dev-insecure-key-do-not-use-in-prod').digest()
    } else {
      const buf = Buffer.from(keyB64, 'base64')
      if (buf.length !== 32) throw new Error('FIELD_ENCRYPTION_KEY must be exactly 32 bytes (base64-encoded)')
      this.key = buf
    }
  }

  /**
   * Encrypts a plaintext string. Returns a base64-encoded string in format:
   * `enc:v1:<iv_base64>:<tag_base64>:<ciphertext_base64>`
   * Returns null if input is null/undefined.
   */
  encrypt(plaintext: string | null | undefined): string | null {
    if (plaintext == null) return null
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', this.key, iv)
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()
    return `enc:v1:${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`
  }

  /**
   * Decrypts a value previously encrypted by encrypt().
   * If the value does not start with 'enc:v1:', assumes it is already plaintext (migration path).
   * Returns null if input is null/undefined.
   */
  decrypt(stored: string | null | undefined): string | null {
    if (stored == null) return null
    if (!stored.startsWith('enc:v1:')) {
      // Legacy plaintext (pre-encryption migration) — return as-is but log a warning
      this.logger.warn('Encountered unencrypted field value — run migration to encrypt existing data')
      return stored
    }
    const parts = stored.split(':')
    if (parts.length !== 5) throw new Error('Invalid encrypted field format')
    const [, , ivB64, tagB64, ctB64] = parts
    const iv = Buffer.from(ivB64, 'base64')
    const tag = Buffer.from(tagB64, 'base64')
    const ciphertext = Buffer.from(ctB64, 'base64')
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv)
    decipher.setAuthTag(tag)
    return decipher.update(ciphertext).toString('utf8') + decipher.final('utf8')
  }

  /** Returns true if the value is already encrypted */
  isEncrypted(value: string | null | undefined): boolean {
    return typeof value === 'string' && value.startsWith('enc:v1:')
  }

  // ── Binary (buffer) encryption ─────────────────────────────────────────────
  //
  // WHY A SEPARATE PAIR FROM encrypt()/decrypt()
  // --------------------------------------------
  // `encrypt()` is string-oriented and base64-encodes the ciphertext, which
  // inflates it by ~33%. A 25 MB workbook would become a 33 MB object and a
  // 33 MB string in memory on every read. These siblings use the SAME key and
  // the same AES-256-GCM construction but keep the payload binary, writing the
  // IV and auth tag as a fixed-size header prefix instead.
  //
  // HEADER LAYOUT (34 bytes, then ciphertext)
  //   0..3    magic 'ENCB'      — lets decryptBuffer recognise an encrypted
  //                               object without a database flag, which is what
  //                               makes the legacy (unencrypted) path safe.
  //   4       format version    — bump if the layout itself changes.
  //   5       KEY version       — which key encrypted this object. Today there
  //                               is exactly one (the FIELD_ENCRYPTION_KEY
  //                               service key, version 1). It is written now so
  //                               that per-tenant DEKs can be introduced later
  //                               by teaching decryptBuffer a second version —
  //                               WITHOUT re-encrypting anything already stored.
  //   6..17   IV (12 bytes, random per object)
  //   18..33  GCM auth tag (16 bytes)

  private static readonly BUF_MAGIC = Buffer.from('ENCB', 'ascii')
  private static readonly BUF_FORMAT_VERSION = 1
  /** The single service key (FIELD_ENCRYPTION_KEY). */
  static readonly KEY_VERSION_SERVICE = 1
  private static readonly BUF_HEADER_BYTES = 4 + 1 + 1 + 12 + 16 // 34

  /** True if the buffer carries our binary-encryption header. */
  isEncryptedBuffer(buf: Buffer | null | undefined): boolean {
    return (
      Buffer.isBuffer(buf) &&
      buf.length >= FieldEncryptionService.BUF_HEADER_BYTES &&
      buf.subarray(0, 4).equals(FieldEncryptionService.BUF_MAGIC)
    )
  }

  /**
   * Encrypts a binary payload. Output is `header || ciphertext` (see layout
   * above) — binary, not base64.
   */
  encryptBuffer(plaintext: Buffer): Buffer {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', this.key, iv)
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
    const tag = cipher.getAuthTag()

    const header = Buffer.alloc(FieldEncryptionService.BUF_HEADER_BYTES)
    FieldEncryptionService.BUF_MAGIC.copy(header, 0)
    header.writeUInt8(FieldEncryptionService.BUF_FORMAT_VERSION, 4)
    header.writeUInt8(FieldEncryptionService.KEY_VERSION_SERVICE, 5)
    iv.copy(header, 6)
    tag.copy(header, 18)

    return Buffer.concat([header, ciphertext])
  }

  /**
   * Decrypts a payload produced by `encryptBuffer`.
   *
   * LEGACY PATH: a buffer without the magic prefix is an object stored before
   * encryption was introduced. It is returned unchanged (with a warning) so
   * existing workbooks stay readable — the same migration accommodation
   * `decrypt()` makes for plaintext field values. A tampered or truncated
   * encrypted object fails the GCM auth tag and throws; it is never silently
   * returned as plaintext, because the magic prefix distinguishes the two cases
   * before any decryption is attempted.
   */
  decryptBuffer(stored: Buffer): Buffer {
    if (!this.isEncryptedBuffer(stored)) {
      this.logger.warn(
        'Read an unencrypted stored object — predates at-rest encryption; it will be encrypted on next write',
      )
      return stored
    }

    const format = stored.readUInt8(4)
    if (format !== FieldEncryptionService.BUF_FORMAT_VERSION) {
      throw new Error(`Unsupported encrypted object format version ${format}`)
    }
    const keyVersion = stored.readUInt8(5)
    if (keyVersion !== FieldEncryptionService.KEY_VERSION_SERVICE) {
      // Deliberately explicit rather than "try the only key we have": a wrong
      // key would fail the auth tag with an opaque error.
      throw new Error(`Unknown encryption key version ${keyVersion}`)
    }

    const iv = stored.subarray(6, 18)
    const tag = stored.subarray(18, 34)
    const ciphertext = stored.subarray(FieldEncryptionService.BUF_HEADER_BYTES)

    const decipher = createDecipheriv('aes-256-gcm', this.key, iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(ciphertext), decipher.final()])
  }

  /** Returns a masked representation — never reveals digits */
  mask(_value: string | null | undefined): string {
    return '***-***-****'
  }
}
