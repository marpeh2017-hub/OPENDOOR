import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  NotFoundException,
} from '@nestjs/common'

/**
 * Typed domain errors.
 *
 * Domain services throw these; controllers never translate them by hand —
 * `toHttp()` does it once, consistently, so the HTTP contract the tests and the
 * CRM rely on cannot drift between modules:
 *
 *   VALIDATION  → 400
 *   NOT_FOUND   → 404   (also the cross-tenant answer — never 403, which would
 *                        confirm the record exists in another tenant)
 *   CONFLICT    → 409
 *   FORBIDDEN   → 403   (role refusal; RolesGuard normally gets there first)
 */
export type DomainErrorKind = 'VALIDATION' | 'NOT_FOUND' | 'CONFLICT' | 'FORBIDDEN'

export interface DomainErrorDetail {
  /** Stable machine code, e.g. `OWNERSHIP_SHARE_SUM_EXCEEDS_ONE`. */
  code: string
  /** Hebrew, user-facing. MUST NOT contain PII (national IDs, secrets). */
  message: string
  /** Optional pointer to the offending row for batch callers (import). */
  path?: string
}

export class DomainError extends Error {
  constructor(
    readonly kind: DomainErrorKind,
    readonly details: DomainErrorDetail[],
  ) {
    super(details[0]?.message ?? kind)
    this.name = 'DomainError'
  }

  static validation(code: string, message: string, path?: string): DomainError {
    return new DomainError('VALIDATION', [{ code, message, ...(path ? { path } : {}) }])
  }

  static notFound(code: string, message: string): DomainError {
    return new DomainError('NOT_FOUND', [{ code, message }])
  }

  static conflict(code: string, message: string): DomainError {
    return new DomainError('CONFLICT', [{ code, message }])
  }

  static forbidden(code: string, message: string): DomainError {
    return new DomainError('FORBIDDEN', [{ code, message }])
  }

  toHttp(): HttpException {
    const body = {
      message: this.details[0]?.message ?? this.kind,
      code: this.details[0]?.code,
      details: this.details,
    }
    switch (this.kind) {
      case 'NOT_FOUND': return new NotFoundException(body)
      case 'CONFLICT': return new ConflictException(body)
      case 'FORBIDDEN': return new ForbiddenException(body)
      default: return new BadRequestException(body)
    }
  }
}

/**
 * Wraps a service call so any DomainError surfaces as the right HTTP status.
 * Non-domain errors propagate untouched (Nest's filter handles them).
 */
export async function mapDomainErrors<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof DomainError) throw err.toHttp()
    throw err
  }
}
