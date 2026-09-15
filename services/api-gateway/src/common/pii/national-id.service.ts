import { Injectable } from '@nestjs/common'
import { FieldEncryptionService } from '../../crypto/field-encryption.service'
import { fingerprint } from '../../data-quality/data-quality.helpers'
import { DomainError } from '../errors/domain-error'

/**
 * The ONE way CRUD services handle `Owner.nationalId` / `Resident.nationalId`.
 *
 * There is exactly one encryption mechanism in this codebase:
 * `FieldEncryptionService` (AES-256-GCM, random IV). This service does not add
 * a second one — it wraps it with the rules every caller kept re-deriving:
 *
 *   - WRITE: validate the check digit, then encrypt. Never persist plaintext.
 *   - COMPARE: because the IV is random, equal IDs produce different
 *     ciphertexts, so ciphertext comparison can NEVER detect duplicates. We
 *     decrypt in memory and reduce to the SHA-256 `fingerprint()` already used
 *     by `duplicate.rule.ts` — the same mechanism, not a parallel one.
 *   - READ: callers get `mask()` output only. The plaintext must never reach an
 *     API response, a log line, an audit `changes`/`metadata` payload or an
 *     error message. Nothing here ever returns or throws a full ID.
 */
@Injectable()
export class NationalIdService {
  constructor(private readonly encryption: FieldEncryptionService) {}

  /**
   * Israeli ID (תעודת זהות) check digit — Luhn-like over 9 zero-padded digits.
   * Returns a boolean; the caller decides whether that is fatal.
   */
  static isValid(raw: string | null | undefined): boolean {
    if (!raw) return false
    const digits = raw.replace(/\D/g, '')
    if (digits.length === 0 || digits.length > 9) return false
    const padded = digits.padStart(9, '0')
    let sum = 0
    for (let i = 0; i < 9; i++) {
      let n = Number(padded[i]) * ((i % 2) + 1)
      if (n > 9) n -= 9
      sum += n
    }
    return sum % 10 === 0
  }

  static normalise(raw: string): string {
    return raw.replace(/\D/g, '').padStart(9, '0')
  }

  /**
   * Validates and encrypts for persistence.
   *
   * `null`/empty clears the field. An invalid ID raises a VALIDATION error
   * whose message deliberately contains NO digits from the input.
   */
  encryptForWrite(raw: string | null | undefined, path?: string): string | null {
    if (raw == null || raw.trim() === '') return null
    if (!NationalIdService.isValid(raw)) {
      throw DomainError.validation(
        'NATIONAL_ID_INVALID',
        'מספר תעודת הזהות אינו תקין (ספרת ביקורת שגויה).',
        path,
      )
    }
    return this.encryption.encrypt(NationalIdService.normalise(raw))
  }

  /**
   * Non-reversible fingerprint of a STORED (encrypted or legacy-plaintext)
   * value, for duplicate detection. Returns `null` when undecryptable.
   * The plaintext exists only inside this call.
   */
  fingerprintStored(stored: string | null | undefined): string | null {
    if (stored == null || stored === '') return null
    try {
      const plain = this.encryption.isEncrypted(stored)
        ? this.encryption.decrypt(stored)
        : stored
      if (!plain || plain.trim() === '') return null
      return fingerprint(plain)
    } catch {
      return null
    }
  }

  /** Fingerprint of raw user input, comparable with `fingerprintStored`. */
  fingerprintRaw(raw: string | null | undefined): string | null {
    if (raw == null || raw.trim() === '') return null
    return fingerprint(NationalIdService.normalise(raw))
  }

  /** Safe for API responses. Never reveals digits. */
  mask(stored: string | null | undefined): string | null {
    if (stored == null || stored === '') return null
    return this.encryption.mask(stored)
  }

  /** True when the field is populated — without revealing anything about it. */
  isPresent(stored: string | null | undefined): boolean {
    return stored != null && stored !== ''
  }

  /**
   * Batch duplicate check for owners, used by manual create/edit AND by Excel
   * import. ONE query loads the tenant's stored IDs; everything else is done on
   * fingerprints in memory. Returns the ids of existing owners that collide.
   *
   * `candidates` are RAW ids keyed by an arbitrary caller reference (row index
   * for import, `new` for a single create).
   */
  findCollisions(
    candidates: ReadonlyMap<string, string | null | undefined>,
    existing: readonly { id: string; nationalId: string | null }[],
    /** Owner ids to ignore (the record being edited). */
    ignoreIds: ReadonlySet<string> = new Set(),
  ): Map<string, string[]> {
    const byFingerprint = new Map<string, string[]>()
    for (const row of existing) {
      if (ignoreIds.has(row.id)) continue
      const fp = this.fingerprintStored(row.nationalId)
      if (!fp) continue
      const list = byFingerprint.get(fp)
      if (list) list.push(row.id)
      else byFingerprint.set(fp, [row.id])
    }

    const out = new Map<string, string[]>()
    // Candidates also collide with EACH OTHER — an import sheet listing the
    // same ID twice must be caught before either row is written.
    const seen = new Map<string, string>()
    for (const [ref, raw] of candidates) {
      const fp = this.fingerprintRaw(raw)
      if (!fp) continue
      const hits = [...(byFingerprint.get(fp) ?? [])]
      const twin = seen.get(fp)
      if (twin !== undefined) hits.push(`ref:${twin}`)
      else seen.set(fp, ref)
      if (hits.length) out.set(ref, hits)
    }
    return out
  }
}
