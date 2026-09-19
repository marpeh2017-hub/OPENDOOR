import { Injectable } from '@nestjs/common'
import { FieldEncryptionService } from '../../crypto/field-encryption.service'
import type { DataQualityRule, DetectedIssue, ScanContext } from '../data-quality.types'
import { fingerprint, isBlank, links, normalisePhone } from '../data-quality.helpers'

/**
 * Cross-record duplicate detection.
 *
 * TENANT-WIDE: duplicates are only meaningful over the whole tenant, so this
 * rule is skipped during single-project scans (a project-limited view would
 * report false negatives and flip issues open/closed between scan scopes).
 *
 * SECURITY: national IDs are AES-256-GCM encrypted with a random IV, so equal
 * plaintexts yield different ciphertexts. We decrypt in memory and immediately
 * reduce to a SHA-256 fingerprint; the plaintext never reaches an issue title,
 * description, metadata field or log line.
 */
@Injectable()
export class DuplicateDataQualityRule implements DataQualityRule {
  readonly id = 'duplicate'
  readonly title = 'איתור כפילויות'
  readonly category = 'DUPLICATION' as const
  readonly severity = 'CRITICAL' as const
  readonly tenantWide = true
  readonly issueTypes = [
    'OWNER_DUPLICATE_NATIONAL_ID',
    'OWNER_DUPLICATE_PHONE',
    'RESIDENT_DUPLICATE_NATIONAL_ID',
  ] as const

  constructor(private readonly encryption: FieldEncryptionService) {}

  private safeFingerprint(stored: string): string | null {
    try {
      const plain = this.encryption.isEncrypted(stored)
        ? this.encryption.decrypt(stored)
        : stored
      if (isBlank(plain)) return null
      return fingerprint(plain as string)
    } catch {
      // Undecryptable value (wrong key / corrupt payload) — cannot be compared.
      return null
    }
  }

  async run(ctx: ScanContext): Promise<DetectedIssue[]> {
    const { prisma, tenantId } = ctx
    const out: DetectedIssue[] = []

    const [owners, residents] = await Promise.all([
      prisma.owner.findMany({
        where: { tenantId },
        select: { id: true, fullName: true, nationalId: true, phone: true },
      }),
      prisma.resident.findMany({
        where: { tenantId, nationalId: { not: null } },
        select: { id: true, firstName: true, lastName: true, nationalId: true, apartmentId: true },
      }),
    ])

    // ── Owner: duplicate national ID ─────────────────────────────────────────
    const byNationalId = new Map<string, { id: string; label: string }[]>()
    for (const o of owners) {
      if (isBlank(o.nationalId)) continue
      const fp = this.safeFingerprint(o.nationalId as string)
      if (!fp) continue
      const arr = byNationalId.get(fp) ?? []
      arr.push({ id: o.id, label: o.fullName })
      byNationalId.set(fp, arr)
    }
    for (const group of byNationalId.values()) {
      if (group.length < 2) continue
      const names = group.map(g => g.label).join(', ')
      for (const member of group) {
        out.push({
          issueType: 'OWNER_DUPLICATE_NATIONAL_ID',
          category: 'DUPLICATION',
          severity: 'CRITICAL',
          entityType: 'OWNER',
          entityId: member.id,
          entityLabel: member.label,
          projectId: null,
          title: 'תעודת זהות משותפת למספר בעלים',
          // The ID itself is deliberately NOT included.
          description: `אותה תעודת זהות רשומה ל-${group.length} רשומות בעלים: ${names}.`,
          impact:
            'ספירת חלקי הבעלות עלולה להיות שגויה ואותו אדם עלול להיספר פעמיים בחישוב רוב החתימות.',
          recommendation:
            'בדקו את הרשומות וודאו איזו מהן נכונה. איחוד או מחיקה מחייבים אישור ידני של מנהל.',
          deepLink: links.owner(member.id),
          metadata: { duplicateCount: group.length, peerIds: group.map(g => g.id) },
        })
      }
    }

    // ── Owner: duplicate phone ───────────────────────────────────────────────
    const byPhone = new Map<string, { id: string; label: string }[]>()
    for (const o of owners) {
      if (isBlank(o.phone)) continue
      const key = normalisePhone(o.phone as string)
      const arr = byPhone.get(key) ?? []
      arr.push({ id: o.id, label: o.fullName })
      byPhone.set(key, arr)
    }
    for (const group of byPhone.values()) {
      if (group.length < 2) continue
      for (const member of group) {
        out.push({
          issueType: 'OWNER_DUPLICATE_PHONE',
          category: 'DUPLICATION',
          severity: 'HIGH',
          entityType: 'OWNER',
          entityId: member.id,
          entityLabel: member.label,
          projectId: null,
          title: 'מספר טלפון משותף למספר בעלים',
          description: `אותו מספר טלפון רשום ל-${group.length} בעלים (${group.map(g => g.label).join(', ')}).`,
          impact:
            'קוד אימות לחתימה דיגיטלית יישלח למכשיר אחד עבור מספר חותמים — סיכון לחתימה על ידי גורם לא מורשה.',
          recommendation:
            'ודאו שלכל בעלים מספר אישי. במקרה של בני זוג — הזינו מספר נפרד לכל אחד.',
          deepLink: links.owner(member.id),
          metadata: { duplicateCount: group.length, peerIds: group.map(g => g.id) },
        })
      }
    }

    // ── Resident: duplicate national ID ──────────────────────────────────────
    const residentByNid = new Map<string, { id: string; label: string }[]>()
    for (const r of residents) {
      const fp = this.safeFingerprint(r.nationalId as string)
      if (!fp) continue
      const arr = residentByNid.get(fp) ?? []
      arr.push({ id: r.id, label: `${r.firstName} ${r.lastName}`.trim() })
      residentByNid.set(fp, arr)
    }
    for (const group of residentByNid.values()) {
      if (group.length < 2) continue
      for (const member of group) {
        out.push({
          issueType: 'RESIDENT_DUPLICATE_NATIONAL_ID',
          category: 'DUPLICATION',
          severity: 'HIGH',
          entityType: 'RESIDENT',
          entityId: member.id,
          entityLabel: member.label,
          projectId: null,
          title: 'תעודת זהות משותפת למספר דיירים',
          description: `אותה תעודת זהות רשומה ל-${group.length} רשומות דייר: ${group.map(g => g.label).join(', ')}.`,
          impact: 'דייר כפול מעוות את מדדי המעורבות ואת דוחות ההתקדמות.',
          recommendation: 'בדקו את הרשומות ואחדו ידנית לאחר אימות.',
          deepLink: links.resident(member.id),
          metadata: { duplicateCount: group.length, peerIds: group.map(g => g.id) },
        })
      }
    }

    return out
  }
}
