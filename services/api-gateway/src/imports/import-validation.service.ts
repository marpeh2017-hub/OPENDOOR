import { Injectable } from '@nestjs/common'
import {
  ImportDecisionAction, ImportEntityType, ImportMode, ImportRowOutcome, ImportIssueSeverity,
} from '@prisma/client'
import { PrismaService } from '../prisma.service'
import { NationalIdService } from '../common/pii/national-id.service'
import {
  Fraction, fractionFromRatioString, percentStringToFraction,
  fractionFromDecimalString, toIntParts,
} from '../common/fractions'
import { isValidEmail, isValidPhone, normalisePhone } from '../data-quality/data-quality.helpers'
import type { ParsedRow, ParsedSheet } from './excel-parser.service'
import { type ImportFieldKey, normaliseHeader } from './import-fields'

/**
 * Row validation and duplicate resolution.
 *
 * THIS FILE CONTAINS NO BUSINESS RULES OF ITS OWN. Every decision it makes is
 * delegated:
 *
 *   national ID format      → `NationalIdService.isValid`
 *   national ID duplicates  → `NationalIdService.findCollisions` (fingerprints)
 *   phone format            → `isValidPhone`   (data-quality.helpers)
 *   email format            → `isValidEmail`   (data-quality.helpers)
 *   tenant boundary         → `TenantScopeService.scopes.*`
 *   share arithmetic        → `src/common/fractions` (exact, BigInt)
 *   share sums / duplicate
 *   owner↔apartment links   → `OwnershipService.validatePlans`, applied by the
 *                             commit step in `imports.service.ts`
 *
 * What IS here is the sheet-shaped part: turning a cell of text into the value
 * those services expect, and deciding which existing record a row refers to.
 *
 * BATCHING. The whole validation pass issues a FIXED number of queries — four —
 * regardless of row count. Nothing in this file queries inside a loop.
 */
@Injectable()
export class ImportValidationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nationalIds: NationalIdService,
  ) {}

  /**
   * Validates every row and decides its outcome.
   *
   * Queries issued (4, independent of row count):
   *   1. apartments in the project (+ building address)
   *   2. owners in the tenant (id, name, phone, encrypted nationalId)
   *   3. existing OwnerApartment links for those apartments
   *   4. residents in the project's apartments (resident imports only)
   */
  async validate(input: ValidateInput): Promise<ValidationResult> {
    const { sheet, mapping, entityType, mode, projectId, tenantId } = input

    const index = await this.loadIndex(projectId, tenantId, entityType)

    const rows: ValidatedRow[] = []
    /** Raw national IDs by row ref, for the ONE batched collision pass. */
    const idCandidates = new Map<string, string>()

    for (const parsed of sheet.rows) {
      const row = this.validateRow(parsed, mapping, entityType, index)
      rows.push(row)
      if (row.values.nationalId) idCandidates.set(String(row.rowNumber), row.values.nationalId)
    }

    // ── National ID duplicates, in one pass over fingerprints ──────────────
    // The plaintext exists only inside findCollisions. Ciphertext comparison
    // could never work here (random IV) — this is the same mechanism
    // duplicate.rule.ts and manual owner create both use.
    const collisions = this.nationalIds.findCollisions(idCandidates, index.identityRows)

    for (const row of rows) {
      const hits = collisions.get(String(row.rowNumber))
      if (!hits?.length) continue

      const inFileTwin = hits.find((h) => h.startsWith('ref:'))
      if (inFileTwin) {
        row.issues.push({
          severity: ImportIssueSeverity.ERROR,
          field: 'nationalId',
          code: 'IMPORT_NATIONAL_ID_DUPLICATE_IN_FILE',
          message: `תעודת הזהות מופיעה גם בשורה ${inFileTwin.slice(4)} באותו קובץ.`,
          suggestion: 'הסירו את אחת השורות הכפולות ונסו שוב.',
          // The VALUE is never recorded — only the fact and the other row.
          currentValue: this.maskId(row.values.nationalId),
        })
      }

      const existingIds = hits.filter((h) => !h.startsWith('ref:'))
      if (existingIds.length) {
        row.match = {
          entityId: existingIds[0],
          reason: 'NATIONAL_ID',
          ambiguous: existingIds.length > 1,
          candidateIds: existingIds,
        }
      }
    }

    // ── Weaker matches, only where the ID gave us nothing ──────────────────
    for (const row of rows) {
      if (row.match || row.hasError()) continue
      const m = this.matchWithoutId(row, index, entityType)
      if (m) row.match = m
    }

    // ── Outcome per row, given the mode ────────────────────────────────────
    for (const row of rows) this.decideOutcome(row, mode)

    // ── Apply the user's rulings on ambiguous rows ─────────────────────────
    // Deliberately AFTER decideOutcome, never instead of it: the automatic pass
    // still computes the candidate set and marks the row NEEDS_REVIEW, and the
    // ruling is then checked against that freshly-computed set. A ruling can
    // therefore never introduce a target the matcher did not independently
    // consider a candidate right now.
    if (input.decisions?.size) {
      for (const row of rows) this.applyDecision(row, input.decisions.get(row.rowNumber), mode)
    }

    return { rows, index }
  }

  // ── One row ───────────────────────────────────────────────────────────────

  private validateRow(
    parsed: ParsedRow,
    mapping: ResolvedMapping,
    entityType: ImportEntityType,
    index: ProjectIndexForImport,
  ): ValidatedRow {
    const row = new ValidatedRow(parsed.rowNumber)
    const cell = (field: ImportFieldKey): string => {
      const col = mapping[field]
      if (col === undefined) return ''
      return (parsed.values[col.index] ?? '').trim()
    }
    const columnOf = (field: ImportFieldKey) => mapping[field]?.column

    // ── Identity ──────────────────────────────────────────────────────────
    if (entityType === ImportEntityType.OWNER) {
      const fullName = cell('fullName')
      if (!fullName) {
        row.issues.push({
          severity: ImportIssueSeverity.ERROR, field: 'fullName', column: columnOf('fullName'),
          code: 'IMPORT_NAME_REQUIRED', message: 'חסר שם בעלים.',
          suggestion: 'הזינו שם מלא כפי שהוא רשום בטאבו.',
        })
      } else if (fullName.length > 200) {
        row.issues.push({
          severity: ImportIssueSeverity.ERROR, field: 'fullName', column: columnOf('fullName'),
          code: 'IMPORT_NAME_TOO_LONG', message: 'השם ארוך מ-200 תווים.',
          currentValue: fullName.slice(0, 60) + '…',
        })
      }
      row.values.fullName = fullName
    } else {
      // A sheet with one "שם" column mapped to firstName is common. Split it
      // rather than refusing the file — but say so, because the split is a
      // guess about where the given name ends.
      let firstName = cell('firstName')
      let lastName = cell('lastName')
      if (firstName && !lastName && !mapping.lastName && firstName.includes(' ')) {
        const parts = firstName.split(/\s+/)
        firstName = parts[0]
        lastName = parts.slice(1).join(' ')
        row.issues.push({
          severity: ImportIssueSeverity.WARNING, field: 'lastName', column: columnOf('firstName'),
          code: 'IMPORT_NAME_SPLIT',
          message: `השם פוצל ל"${firstName}" ו"${lastName}".`,
          suggestion: 'לדיוק מלא, פצלו את העמודה ל"שם פרטי" ו"שם משפחה".',
        })
      }
      if (!firstName || !lastName) {
        row.issues.push({
          severity: ImportIssueSeverity.ERROR, field: !firstName ? 'firstName' : 'lastName',
          column: columnOf(!firstName ? 'firstName' : 'lastName'),
          code: 'IMPORT_NAME_REQUIRED', message: 'חסר שם פרטי או שם משפחה.',
          suggestion: 'הזינו שם פרטי ושם משפחה.',
        })
      }
      row.values.firstName = firstName
      row.values.lastName = lastName
    }

    // ── National ID (format only; duplicates are a batch pass) ────────────
    const rawId = cell('nationalId')
    if (rawId) {
      // A 9-digit ID that lost its leading zero to Excel's number format is the
      // single most common defect in these sheets. NationalIdService.normalise
      // zero-pads, so we validate the padded form and only warn.
      const digits = rawId.replace(/\D/g, '')
      if (!digits) {
        row.issues.push({
          severity: ImportIssueSeverity.ERROR, field: 'nationalId', column: columnOf('nationalId'),
          code: 'IMPORT_NATIONAL_ID_INVALID',
          message: 'תעודת הזהות אינה מכילה ספרות.',
          // No digits to leak — but keep the masking discipline uniform.
          currentValue: this.maskId(rawId),
          suggestion: 'הזינו 9 ספרות.',
        })
      } else if (digits.length > 9) {
        row.issues.push({
          severity: ImportIssueSeverity.ERROR, field: 'nationalId', column: columnOf('nationalId'),
          code: 'IMPORT_NATIONAL_ID_TOO_LONG',
          message: 'תעודת הזהות ארוכה מ-9 ספרות.',
          currentValue: this.maskId(rawId),
        })
      } else if (!NationalIdService.isValid(rawId)) {
        row.issues.push({
          severity: ImportIssueSeverity.ERROR, field: 'nationalId', column: columnOf('nationalId'),
          code: 'IMPORT_NATIONAL_ID_INVALID',
          message: 'ספרת הביקורת של תעודת הזהות שגויה.',
          currentValue: this.maskId(rawId),
          suggestion: 'בדקו את המספר מול תעודת הזהות. ניתן גם להשאיר את התא ריק.',
        })
      } else {
        if (digits.length < 9) {
          row.issues.push({
            severity: ImportIssueSeverity.WARNING, field: 'nationalId', column: columnOf('nationalId'),
            code: 'IMPORT_NATIONAL_ID_PADDED',
            message: `תעודת הזהות הושלמה ל-9 ספרות באפסים מובילים (${digits.length} ספרות בקובץ).`,
            currentValue: this.maskId(rawId),
            suggestion: 'עצבו את העמודה כטקסט באקסל כדי לשמר אפסים מובילים.',
          })
        }
        row.values.nationalId = rawId
      }
    }

    // ── Phone ─────────────────────────────────────────────────────────────
    const rawPhone = cell('phone')
    if (rawPhone) {
      if (!isValidPhone(rawPhone)) {
        row.issues.push({
          severity: ImportIssueSeverity.ERROR, field: 'phone', column: columnOf('phone'),
          code: 'IMPORT_PHONE_INVALID',
          message: 'מספר הטלפון אינו תקין.',
          currentValue: rawPhone,
          suggestion: 'הזינו מספר ישראלי, לדוגמה 0501234567.',
        })
      } else {
        row.values.phone = normalisePhone(rawPhone)
      }
    }
    const rawPhone2 = cell('phone2')
    if (rawPhone2) {
      if (!isValidPhone(rawPhone2)) {
        row.issues.push({
          severity: ImportIssueSeverity.WARNING, field: 'phone2', column: columnOf('phone2'),
          code: 'IMPORT_PHONE2_INVALID',
          message: 'הטלפון הנוסף אינו תקין ולא ייובא.',
          currentValue: rawPhone2,
        })
      } else {
        row.values.phone2 = normalisePhone(rawPhone2)
      }
    }

    // ── Email ─────────────────────────────────────────────────────────────
    const rawEmail = cell('email')
    if (rawEmail) {
      if (!isValidEmail(rawEmail)) {
        row.issues.push({
          severity: ImportIssueSeverity.ERROR, field: 'email', column: columnOf('email'),
          code: 'IMPORT_EMAIL_INVALID',
          message: 'כתובת הדואר האלקטרוני אינה תקינה.',
          currentValue: rawEmail,
          suggestion: 'לדוגמה: name@example.com. ניתן גם להשאיר ריק.',
        })
      } else {
        row.values.email = rawEmail.trim()
      }
    }

    // ── Free text ─────────────────────────────────────────────────────────
    row.values.notes = cell('notes').slice(0, 2000) || undefined
    if (entityType === ImportEntityType.OWNER) {
      row.values.addressAbroad = cell('addressAbroad').slice(0, 300) || undefined
      row.values.isEstate = parseBoolean(cell('isEstate'))
      row.values.viaInheritance = parseBoolean(cell('viaInheritance')) ?? false
    }

    // ── Apartment ─────────────────────────────────────────────────────────
    const aptRaw = cell('apartmentNumber')
    const buildingRaw = cell('buildingAddress')
    if (!aptRaw) {
      row.issues.push({
        severity: ImportIssueSeverity.ERROR, field: 'apartmentNumber', column: columnOf('apartmentNumber'),
        code: 'IMPORT_APARTMENT_REQUIRED',
        message: 'חסר מספר דירה — לא ניתן לשייך את השורה לפרויקט.',
        suggestion: 'הוסיפו עמודת "מספר דירה".',
      })
    } else {
      const resolved = this.resolveApartment(aptRaw, buildingRaw, index)
      if (resolved.kind === 'FOUND') {
        row.apartmentId = resolved.id
      } else if (resolved.kind === 'AMBIGUOUS') {
        row.issues.push({
          severity: ImportIssueSeverity.ERROR, field: 'apartmentNumber', column: columnOf('apartmentNumber'),
          code: 'IMPORT_APARTMENT_AMBIGUOUS',
          message: `מספר דירה ${aptRaw} קיים ב-${resolved.count} בניינים בפרויקט.`,
          currentValue: aptRaw,
          suggestion: 'הוסיפו עמודת "כתובת" כדי לזהות את הבניין.',
        })
      } else {
        row.issues.push({
          severity: ImportIssueSeverity.ERROR, field: 'apartmentNumber', column: columnOf('apartmentNumber'),
          code: 'IMPORT_APARTMENT_NOT_FOUND',
          message: buildingRaw
            ? `לא נמצאה דירה ${aptRaw} בכתובת "${buildingRaw}" בפרויקט זה.`
            : `לא נמצאה דירה ${aptRaw} בפרויקט זה.`,
          currentValue: buildingRaw ? `${buildingRaw} / ${aptRaw}` : aptRaw,
          suggestion: 'צרו את הדירה במסך הבניינים, או תקנו את מספר הדירה בקובץ.',
        })
      }
    }

    // ── Ownership share ───────────────────────────────────────────────────
    if (entityType === ImportEntityType.OWNER) {
      const rawShare = cell('share')
      if (!rawShare) {
        // No share column at all is a legitimate sheet: a list of who owns what
        // without the fractions. We default to the whole apartment ONLY when the
        // apartment has no other owner; otherwise the sum rule would reject it,
        // which is the correct outcome and is raised by OwnershipService.
        row.values.share = null
        row.issues.push({
          severity: ImportIssueSeverity.WARNING, field: 'share', column: columnOf('share'),
          code: 'IMPORT_SHARE_MISSING',
          message: 'לא צוין חלק בבעלות — יוגדר 1/1 (בעלות מלאה).',
          suggestion: 'אם לדירה כמה בעלים, הוסיפו עמודת "חלק בבעלות" עם ערכים כמו 1/3.',
        })
      } else {
        const parsedShare = parseShareCell(rawShare)
        if (!parsedShare) {
          row.issues.push({
            severity: ImportIssueSeverity.ERROR, field: 'share', column: columnOf('share'),
            code: 'IMPORT_SHARE_UNPARSEABLE',
            message: `לא ניתן לפרש את חלק הבעלות "${rawShare}".`,
            currentValue: rawShare,
            suggestion: 'כתבו שבר כמו 1/3, או אחוז כמו 33.33%.',
          })
        } else {
          const parts = toIntParts(parsedShare.fraction)
          if (!parts) {
            // Only reachable for a cell whose exact decimal expansion needs a
            // denominator beyond int4 — e.g. a pasted 0.333333333333333315.
            row.issues.push({
              severity: ImportIssueSeverity.ERROR, field: 'share', column: columnOf('share'),
              code: 'IMPORT_SHARE_TOO_PRECISE',
              message: `חלק הבעלות "${rawShare}" מכיל יותר מדי ספרות עשרוניות לייצוג מדויק.`,
              currentValue: rawShare,
              suggestion: 'כתבו את השבר במפורש, לדוגמה 1/3 במקום 0.333333…',
            })
          } else {
            row.values.share = parts
            if (parsedShare.warning) {
              row.issues.push({
                severity: ImportIssueSeverity.WARNING, field: 'share', column: columnOf('share'),
                code: parsedShare.warning.code,
                message: parsedShare.warning.message,
                currentValue: rawShare,
                suggestion: parsedShare.warning.suggestion,
              })
            }
          }
        }
      }
    }

    return row
  }

  // ── Apartment resolution (pure — reads the prebuilt index) ────────────────

  private resolveApartment(
    apartmentNumber: string,
    buildingHint: string,
    index: ProjectIndexForImport,
  ): { kind: 'FOUND'; id: string } | { kind: 'AMBIGUOUS'; count: number } | { kind: 'MISSING' } {
    const apt = normaliseKey(apartmentNumber)
    if (!apt) return { kind: 'MISSING' }

    if (buildingHint) {
      const b = normaliseKey(buildingHint)
      const exact = index.byBuildingAndApartment.get(`${b}|${apt}`)
      if (exact) return { kind: 'FOUND', id: exact }
      // The hint may be "הרצל 5" against a building stored as address "הרצל"
      // + streetNumber "5", or vice versa — the index registers both forms, so
      // a miss here means a partial-word match is the only remaining option.
      const partial = index.buildingKeys.filter((k) => k.includes(b) || b.includes(k))
      const hits = partial
        .map((k) => index.byBuildingAndApartment.get(`${k}|${apt}`))
        .filter((v): v is string => Boolean(v))
      const unique = [...new Set(hits)]
      if (unique.length === 1) return { kind: 'FOUND', id: unique[0] }
      if (unique.length > 1) return { kind: 'AMBIGUOUS', count: unique.length }
      return { kind: 'MISSING' }
    }

    const byNumber = index.byApartmentNumber.get(apt)
    if (!byNumber?.length) return { kind: 'MISSING' }
    if (byNumber.length > 1) return { kind: 'AMBIGUOUS', count: byNumber.length }
    return { kind: 'FOUND', id: byNumber[0] }
  }

  // ── Duplicate matching without a national ID ──────────────────────────────

  /**
   * Weaker signals, applied ONLY when the national ID produced no match.
   *
   * Neither of these is trusted enough to merge on. A phone match or a
   * name+apartment match sets `ambiguous` whenever more than one existing
   * record fits, and the outcome becomes NEEDS_REVIEW rather than UPDATE — the
   * user decides. Two different heirs sharing a household landline is common
   * enough that auto-merging on phone would corrupt real ownership data.
   */
  private matchWithoutId(
    row: ValidatedRow,
    index: ProjectIndexForImport,
    entityType: ImportEntityType,
  ): RowMatch | null {
    if (entityType === ImportEntityType.OWNER) {
      if (row.apartmentId && row.values.fullName) {
        const key = `${normaliseKey(row.values.fullName)}|${row.apartmentId}`
        const hits = index.ownersByNameAndApartment.get(key)
        if (hits?.length) {
          return {
            entityId: hits[0], reason: 'NAME_AND_APARTMENT',
            ambiguous: hits.length > 1, candidateIds: hits,
          }
        }
      }
      if (row.values.phone) {
        const hits = index.ownersByPhone.get(row.values.phone)
        if (hits?.length) {
          return {
            entityId: hits[0], reason: 'PHONE',
            // A phone alone is never a confident identity match.
            ambiguous: true, candidateIds: hits,
          }
        }
      }
      return null
    }

    // Residents: a person is identified by their apartment far more reliably
    // than an owner is, because a resident record IS a tenancy of one flat.
    if (row.apartmentId && row.values.firstName && row.values.lastName) {
      const key = `${normaliseKey(`${row.values.firstName} ${row.values.lastName}`)}|${row.apartmentId}`
      const hits = index.residentsByNameAndApartment.get(key)
      if (hits?.length) {
        return {
          entityId: hits[0], reason: 'NAME_AND_APARTMENT',
          ambiguous: hits.length > 1, candidateIds: hits,
        }
      }
    }
    if (row.values.phone) {
      const hits = index.residentsByPhone.get(row.values.phone)
      if (hits?.length) {
        return { entityId: hits[0], reason: 'PHONE', ambiguous: true, candidateIds: hits }
      }
    }
    return null
  }

  // ── Outcome ───────────────────────────────────────────────────────────────

  private decideOutcome(row: ValidatedRow, mode: ImportMode): void {
    if (row.hasError()) { row.outcome = ImportRowOutcome.INVALID; return }

    if (row.match?.ambiguous) {
      row.outcome = ImportRowOutcome.NEEDS_REVIEW
      row.issues.push({
        severity: ImportIssueSeverity.WARNING,
        code: 'IMPORT_DUPLICATE_AMBIGUOUS',
        message: `נמצאו ${row.match.candidateIds.length} רשומות קיימות שעשויות להתאים (${matchReasonHe(row.match.reason)}). השורה לא תיובא ללא הכרעה.`,
        suggestion: 'בדקו ידנית והוסיפו תעודת זהות לקובץ כדי לזהות באופן חד-משמעי.',
        matchedEntityId: row.match.entityId,
        matchReason: row.match.reason,
      })
      return
    }

    if (row.match) {
      if (mode === ImportMode.ADD_ONLY) {
        row.outcome = ImportRowOutcome.SKIP_DUPLICATE
        row.issues.push({
          severity: ImportIssueSeverity.WARNING,
          code: 'IMPORT_SKIPPED_EXISTING',
          message: `הרשומה כבר קיימת (${matchReasonHe(row.match.reason)}) ובמצב "הוספה בלבד" היא לא עודכנה.`,
          matchedEntityId: row.match.entityId,
          matchReason: row.match.reason,
        })
        return
      }
      row.outcome = ImportRowOutcome.UPDATE
      return
    }

    if (mode === ImportMode.UPDATE_ONLY) {
      row.outcome = ImportRowOutcome.SKIP_MODE
      row.issues.push({
        severity: ImportIssueSeverity.WARNING,
        code: 'IMPORT_SKIPPED_NEW',
        message: 'לא נמצאה רשומה קיימת תואמת, ובמצב "עדכון בלבד" לא נוצרה רשומה חדשה.',
      })
      return
    }

    row.outcome = ImportRowOutcome.CREATE
  }

  /**
   * Applies one human ruling to one row.
   *
   * SAFETY PROPERTIES, in order of importance:
   *
   *  1. A ruling only ever applies to a row the CURRENT validation pass has
   *     independently marked NEEDS_REVIEW. A stale ruling on a row that is no
   *     longer ambiguous (the user added the national ID and re-uploaded, or a
   *     colleague deleted the confusing record) is ignored, not applied.
   *  2. UPDATE_EXISTING is refused unless the chosen id is still in this row's
   *     LIVE candidate list. Someone else deleting or renaming the record
   *     between the ruling and the commit turns the row into an ERROR — it does
   *     not write to a stale or substituted target.
   *  3. There is no MERGE. UPDATE_EXISTING overwrites ONE named record from the
   *     sheet row; CREATE_NEW makes a second, separate record. Two existing
   *     records are never combined by anything here.
   *  4. Mode still wins. A CREATE_NEW ruling under UPDATE_ONLY does not smuggle
   *     a creation past the mode the user chose, and vice versa.
   */
  private applyDecision(
    row: ValidatedRow,
    decision: RowDecision | undefined,
    mode: ImportMode,
  ): void {
    if (!decision) return
    // (1) Only rows this pass still considers ambiguous are rulable.
    if (row.outcome !== ImportRowOutcome.NEEDS_REVIEW || !row.match?.ambiguous) return

    if (decision.action === ImportDecisionAction.SKIP) {
      row.outcome = ImportRowOutcome.SKIP_DUPLICATE
      row.issues.push({
        severity: ImportIssueSeverity.WARNING,
        code: 'IMPORT_RESOLVED_SKIP',
        message: 'הוכרע ידנית: השורה לא תיובא.',
        matchedEntityId: row.match.entityId,
        matchReason: row.match.reason,
      })
      return
    }

    if (decision.action === ImportDecisionAction.CREATE_NEW) {
      // (4) Mode still wins.
      if (mode === ImportMode.UPDATE_ONLY) {
        row.outcome = ImportRowOutcome.SKIP_MODE
        row.issues.push({
          severity: ImportIssueSeverity.WARNING,
          code: 'IMPORT_RESOLVED_CREATE_BLOCKED_BY_MODE',
          message: 'הוכרע ידנית ליצירת רשומה חדשה, אך מצב הייבוא הוא "עדכון בלבד" ולכן לא נוצרה רשומה.',
        })
        return
      }
      // (3) A deliberate second record — NOT a merge. Dropping the match is
      // what makes the commit treat this row as a plain creation.
      row.match = undefined
      row.outcome = ImportRowOutcome.CREATE
      row.issues.push({
        severity: ImportIssueSeverity.WARNING,
        code: 'IMPORT_RESOLVED_CREATE_NEW',
        message: 'הוכרע ידנית: נוצרה רשומה חדשה ונפרדת מהרשומה הקיימת.',
      })
      return
    }

    // UPDATE_EXISTING
    const target = decision.targetEntityId
    // (2) Re-check against the live candidate set.
    if (!target || !row.match.candidateIds.includes(target)) {
      row.outcome = ImportRowOutcome.INVALID
      row.issues.push({
        severity: ImportIssueSeverity.ERROR,
        code: 'IMPORT_DECISION_TARGET_STALE',
        message:
          'הרשומה שנבחרה בהכרעה אינה עוד בין ההתאמות האפשריות של שורה זו. ייתכן שהיא נמחקה או עודכנה. הכריעו מחדש.',
        suggestion: 'פתחו שוב את מסך ההכרעות ובחרו רשומה קיימת מהרשימה המעודכנת.',
      })
      return
    }

    if (mode === ImportMode.ADD_ONLY) {
      row.outcome = ImportRowOutcome.SKIP_DUPLICATE
      row.issues.push({
        severity: ImportIssueSeverity.WARNING,
        code: 'IMPORT_RESOLVED_UPDATE_BLOCKED_BY_MODE',
        message: 'הוכרע ידנית לעדכון רשומה קיימת, אך מצב הייבוא הוא "הוספה בלבד" ולכן לא בוצע עדכון.',
      })
      return
    }

    // Pin the match to the CHOSEN record, not the matcher's first guess.
    row.match = { ...row.match, entityId: target, ambiguous: false }
    row.outcome = ImportRowOutcome.UPDATE
    row.issues.push({
      severity: ImportIssueSeverity.WARNING,
      code: 'IMPORT_RESOLVED_UPDATE_EXISTING',
      message: 'הוכרע ידנית: השורה תעדכן את הרשומה הקיימת שנבחרה.',
      matchedEntityId: target,
      matchReason: row.match.reason,
    })
  }

  // ── Index (4 queries) ─────────────────────────────────────────────────────

  /**
   * Loads everything the whole validation pass needs, once.
   *
   * Scoped through `TenantScopeService.scopes` in every query, so an apartment
   * in another tenant's project is simply absent from the index and its rows
   * report "apartment not found" — the cross-tenant answer is indistinguishable
   * from the not-there answer, matching the rule in TenantScopeService.
   */
  private async loadIndex(
    projectId: string,
    tenantId: string,
    entityType: ImportEntityType,
  ): Promise<ProjectIndexForImport> {
    const apartments = await this.prisma.apartment.findMany({
      // NOTE: do NOT spread `TenantScopeService.scopes.apartment(tenantId)` here.
      // It returns `{ building: { complex: { project: { tenantId } } } }`, whose
      // `building` key would overwrite the one below and silently drop the
      // `projectId` filter — indexing apartments from every project in the
      // tenant, so an apartment number could match the wrong project. The
      // tenant scope is instead folded into the same nested filter.
      where: {
        building: { complex: { projectId, project: { tenantId } } },
      },
      select: {
        id: true, apartmentNumber: true,
        building: { select: { id: true, address: true, streetNumber: true } },
      },
    })

    const byApartmentNumber = new Map<string, string[]>()
    const byBuildingAndApartment = new Map<string, string>()
    const buildingKeySet = new Set<string>()
    const apartmentLabels = new Map<string, string>()

    for (const a of apartments) {
      const apt = normaliseKey(a.apartmentNumber)
      push(byApartmentNumber, apt, a.id)

      const addr = a.building.address ?? ''
      const num = a.building.streetNumber ?? ''
      // Register every spelling a sheet might use for this building.
      const forms = new Set(
        [addr, `${addr} ${num}`, `${addr}${num}`, num]
          .map(normaliseKey)
          .filter(Boolean),
      )
      for (const f of forms) {
        buildingKeySet.add(f)
        byBuildingAndApartment.set(`${f}|${apt}`, a.id)
      }
      apartmentLabels.set(a.id, `${addr}${num ? ' ' + num : ''} — דירה ${a.apartmentNumber}`)
    }

    const apartmentIds = apartments.map((a) => a.id)

    // Owners are matched tenant-wide (an owner may hold flats in several
    // projects and must not be duplicated), but the name+apartment index is
    // built only over this project's apartments.
    const owners = await this.prisma.owner.findMany({
      where: { tenantId },
      select: { id: true, fullName: true, phone: true, email: true, isActive: true, nationalId: true },
    })

    const links = apartmentIds.length
      ? await this.prisma.ownerApartment.findMany({
          where: { apartmentId: { in: apartmentIds } },
          select: { ownerId: true, apartmentId: true, shareNumerator: true, shareDenominator: true, viaInheritance: true },
        })
      : []

    const ownersByPhone = new Map<string, string[]>()
    const ownersByNameAndApartment = new Map<string, string[]>()
    const ownerById = new Map<string, OwnerIndexRow>()
    for (const o of owners) {
      ownerById.set(o.id, {
        id: o.id, fullName: o.fullName, phone: o.phone, email: o.email, isActive: o.isActive,
      })
      if (o.phone) push(ownersByPhone, normalisePhone(o.phone), o.id)
    }
    for (const l of links) {
      const o = ownerById.get(l.ownerId)
      if (!o) continue
      push(ownersByNameAndApartment, `${normaliseKey(o.fullName)}|${l.apartmentId}`, o.id)
    }

    // Residents only for the resident path — no point paying for the query on
    // an owner import.
    const residents = entityType === ImportEntityType.RESIDENT && apartmentIds.length
      ? await this.prisma.resident.findMany({
          where: { tenantId, apartmentId: { in: apartmentIds } },
          select: {
            id: true, firstName: true, lastName: true, phone: true, email: true,
            apartmentId: true, isActive: true, nationalId: true,
          },
        })
      : []

    const residentsByPhone = new Map<string, string[]>()
    const residentsByNameAndApartment = new Map<string, string[]>()
    const residentById = new Map<string, ResidentIndexRow>()
    for (const r of residents) {
      residentById.set(r.id, {
        id: r.id, firstName: r.firstName, lastName: r.lastName,
        phone: r.phone, email: r.email, apartmentId: r.apartmentId, isActive: r.isActive,
      })
      if (r.phone) push(residentsByPhone, normalisePhone(r.phone), r.id)
      push(residentsByNameAndApartment, `${normaliseKey(`${r.firstName} ${r.lastName}`)}|${r.apartmentId}`, r.id)
    }

    // The rows fed to findCollisions carry the ENCRYPTED value; the service
    // decrypts each one in memory and keeps only a fingerprint.
    const identityRows = entityType === ImportEntityType.RESIDENT
      ? residents.map((r) => ({ id: r.id, nationalId: r.nationalId }))
      : owners.map((o) => ({ id: o.id, nationalId: o.nationalId }))

    const existingLinks = new Map<string, ExistingHolding[]>()
    for (const l of links) {
      push(existingLinks, l.apartmentId, {
        ownerId: l.ownerId,
        shareNumerator: l.shareNumerator,
        shareDenominator: l.shareDenominator,
        viaInheritance: l.viaInheritance,
      } as never)
    }

    return {
      projectId,
      apartmentIds,
      apartmentLabels,
      byApartmentNumber,
      byBuildingAndApartment,
      buildingKeys: [...buildingKeySet],
      ownersByPhone,
      ownersByNameAndApartment,
      ownerById,
      residentsByPhone,
      residentsByNameAndApartment,
      residentById,
      identityRows,
      existingLinks: existingLinks as unknown as Map<string, ExistingHolding[]>,
    }
  }

  /**
   * Mask for anything derived from a national ID.
   *
   * Never uses the input's own digits: a fixed marker plus the length is all a
   * user needs to find the offending cell, and it cannot leak the number into
   * the error report, which is downloadable.
   */
  private maskId(raw: string | undefined): string {
    if (!raw) return '—'
    const digits = raw.replace(/\D/g, '')
    return digits.length ? `••••••••• (${digits.length} ספרות)` : '•••'
  }
}

// ─── Cell parsers ────────────────────────────────────────────────────────────

/**
 * A share cell → an exact Fraction of one.
 *
 * Precedence, and why:
 *   1. `"1/3"`      — an explicit ratio. LOSSLESS, and what the template asks
 *                     for. Three heirs at `1/3` sum to exactly 1.
 *   2. `"33.33%"`   — an explicit percentage. Parsed as a STRING scaled by a
 *                     power of ten (`3333/10000`), never through `Number()`.
 *                     Three heirs at `33.33%` sum to `9999/10000`, which is
 *                     correctly NOT 1 — OwnershipService reports the gap rather
 *                     than an epsilon papering over it.
 *   3. a bare number > 1  — read as a percentage (`50` means 50%). Nothing else
 *                     is plausible; a share cannot exceed 1.
 *   4. a bare number ≤ 1  — read as a fraction of one (`0.5` means a half),
 *                     WITH a warning, because `0.5` could conceivably have been
 *                     meant as 0.5%. The warning states the interpretation.
 *
 * Hebrew sheets sometimes write `"1/3 חלקים"` or `"50 אחוז"`; the trailing word
 * is stripped before parsing.
 */
export function parseShareCell(raw: string): {
  fraction: Fraction
  warning?: { code: string; message: string; suggestion?: string }
} | null {
  let s = raw.trim()
  if (!s) return null

  // Strip a trailing Hebrew/English unit word and any thousands separators that
  // could only be noise in a value bounded by 1.
  s = s
    .replace(/\s*(חלקים|חלק|אחוזים|אחוז|percent|pct)\s*$/i, '')
    .replace(/‏|‎/g, '') // RTL/LTR marks Excel loves to add
    .trim()

  const ratio = fractionFromRatioString(s)
  if (ratio) {
    // Same bound as the percentage branch: `3/2` of an apartment is not a
    // share, it is a typo.
    if (ratio.isNegative() || ratio.isZero() || ratio.gt(Fraction.ONE)) return null
    return { fraction: ratio }
  }

  const hasPercentSign = /%\s*$/.test(s)
  if (hasPercentSign) {
    const pct = percentStringToFraction(s)
    if (!pct || pct.isNegative() || pct.isZero()) return null
    // A share cannot exceed the whole. `150%` is not a share the caller can
    // round down to something sensible — it is a data error, and letting it
    // through would only surface later as a share-sum violation that names the
    // apartment rather than the cell the user has to fix.
    if (pct.gt(Fraction.ONE)) return null
    return { fraction: pct }
  }

  const bare = fractionFromDecimalString(s)
  if (!bare || bare.isNegative() || bare.isZero()) return null

  if (bare.gt(Fraction.ONE)) {
    const asPercent = bare.mul(Fraction.from(1n, 100n))
    if (asPercent.gt(Fraction.ONE)) return null // > 100% — genuinely invalid
    return {
      fraction: asPercent,
      warning: {
        code: 'IMPORT_SHARE_ASSUMED_PERCENT',
        message: `הערך "${raw}" פורש כאחוז (${asPercent.mul(Fraction.from(100n)).toString()}%).`,
        suggestion: 'להסרת ספק, כתבו 33.33% או 1/3.',
      },
    }
  }

  return {
    fraction: bare,
    warning: {
      code: 'IMPORT_SHARE_ASSUMED_FRACTION',
      message: `הערך "${raw}" פורש כחלק מתוך 1 (${bare.toString()}).`,
      suggestion: 'אם התכוונתם לאחוזים, כתבו את הסימן %.',
    },
  }
}

/** Hebrew and English truthiness as it actually appears in these sheets. */
export function parseBoolean(raw: string): boolean | undefined {
  const s = raw.trim().toLowerCase()
  if (!s) return undefined
  if (['כן', 'yes', 'y', 'true', '1', 'v', 'x', '✓', 'נכון'].includes(s)) return true
  if (['לא', 'no', 'n', 'false', '0', '', 'לא נכון'].includes(s)) return false
  return undefined
}

/**
 * Canonical form for matching a name, an apartment number or an address.
 *
 * Reuses the header normaliser: same treatment of Hebrew points, punctuation
 * and whitespace, so `"הרצל 5"`, `"הרצל  5"` and `"הרצל־5"` are one key.
 */
export function normaliseKey(raw: string | null | undefined): string {
  if (!raw) return ''
  return normaliseHeader(String(raw))
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key)
  if (list) list.push(value)
  else map.set(key, [value])
}

function matchReasonHe(reason: MatchReason): string {
  switch (reason) {
    case 'NATIONAL_ID': return 'לפי תעודת זהות'
    case 'PHONE': return 'לפי טלפון'
    case 'NAME_AND_APARTMENT': return 'לפי שם ודירה'
    default: return 'לפי מזהה'
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type MatchReason = 'NATIONAL_ID' | 'OWNER_ID' | 'PHONE' | 'NAME_AND_APARTMENT'

export interface RowMatch {
  entityId: string
  reason: MatchReason
  /** More than one plausible existing record. Never auto-merged. */
  ambiguous: boolean
  candidateIds: string[]
}

export interface RowIssue {
  severity: ImportIssueSeverity
  field?: string
  column?: string
  code: string
  message: string
  /** Masked wherever the field is PII. */
  currentValue?: string
  suggestion?: string
  matchedEntityId?: string
  matchReason?: string
}

export interface RowValues {
  fullName?: string
  firstName?: string
  lastName?: string
  /** RAW national ID. Never persisted from here — handed to NationalIdService. */
  nationalId?: string
  phone?: string
  phone2?: string
  email?: string
  notes?: string
  addressAbroad?: string
  isEstate?: boolean
  viaInheritance?: boolean
  /** `null` means "no share column" → defaults to 1/1 at commit. */
  share?: { shareNumerator: number; shareDenominator: number } | null
}

export class ValidatedRow {
  readonly issues: RowIssue[] = []
  values: RowValues = {}
  apartmentId?: string
  match?: RowMatch
  outcome: ImportRowOutcome = ImportRowOutcome.INVALID

  constructor(readonly rowNumber: number) {}

  hasError(): boolean {
    return this.issues.some((i) => i.severity === ImportIssueSeverity.ERROR)
  }

  /** Will this row actually write something? */
  willWrite(): boolean {
    return this.outcome === ImportRowOutcome.CREATE || this.outcome === ImportRowOutcome.UPDATE
  }
}

export interface MappedColumn {
  index: number
  column: string
  confidence: number
  source: 'AUTO' | 'USER'
}

export type ResolvedMapping = Partial<Record<ImportFieldKey, MappedColumn>>

/** One persisted human ruling, keyed by sheet row number. */
export interface RowDecision {
  action: ImportDecisionAction
  targetEntityId?: string | null
}

export interface ValidateInput {
  sheet: ParsedSheet
  mapping: ResolvedMapping
  entityType: ImportEntityType
  mode: ImportMode
  projectId: string
  tenantId: string
  /**
   * The user's rulings on ambiguous rows, by row number. Optional: a job with
   * no ambiguous rows never has any, and the automatic outcome is unchanged
   * when this is absent.
   */
  decisions?: Map<number, RowDecision>
}

export interface OwnerIndexRow {
  id: string
  fullName: string
  phone: string | null
  email: string | null
  isActive: boolean
}

export interface ResidentIndexRow {
  id: string
  firstName: string
  lastName: string
  phone: string | null
  email: string | null
  apartmentId: string
  isActive: boolean
}

export interface ExistingHolding {
  ownerId: string
  shareNumerator: number
  shareDenominator: number
  viaInheritance: boolean
}

export interface ProjectIndexForImport {
  projectId: string
  apartmentIds: string[]
  apartmentLabels: Map<string, string>
  byApartmentNumber: Map<string, string[]>
  byBuildingAndApartment: Map<string, string>
  buildingKeys: string[]
  ownersByPhone: Map<string, string[]>
  ownersByNameAndApartment: Map<string, string[]>
  ownerById: Map<string, OwnerIndexRow>
  residentsByPhone: Map<string, string[]>
  residentsByNameAndApartment: Map<string, string[]>
  residentById: Map<string, ResidentIndexRow>
  /** `{ id, encrypted nationalId }` for the fingerprint pass. */
  identityRows: { id: string; nationalId: string | null }[]
  existingLinks: Map<string, ExistingHolding[]>
}

export interface ValidationResult {
  rows: ValidatedRow[]
  index: ProjectIndexForImport
}
