import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { StorageService } from '../storage/storage.service'
import type { PortalScope } from './portal-scope.service'

/**
 * The documents one resident is entitled to see.
 *
 * ── WHAT "THEIR OWN" MEANS, PRECISELY ───────────────────────────────────────
 *
 * Not "documents in their project". A project's document library holds the
 * developer agreement, other residents' identity papers, the lawyer's drafts
 * and the municipality correspondence; a resident is entitled to none of it by
 * virtue of living there.
 *
 * A resident sees a document when somebody deliberately put it in front of
 * them, which happens in exactly two ways:
 *
 *   1. SHARED    — a `ResidentDocument` row. Staff attached this document to
 *                  this resident. The row IS the sharing decision.
 *   2. SIGNATURE — a `SignatureRequest` naming this resident and a document.
 *                  They were asked to sign it, so they may read it.
 *
 * Both are per-resident and both are acts, not inferences. There is no third
 * rule, and in particular there is no "documents for my apartment": `Document`
 * has a `projectId` and no apartment link, so a rule at that level would be a
 * rule at project level wearing a disguise.
 *
 * ── WHAT THE PAGE PROMISED THAT DOES NOT EXIST ──────────────────────────────
 *
 * The mock showed rows marked "נדרש" and "ממתין" with an "העלה" button — a
 * checklist of documents the resident still owes, and a resident upload. There
 * is no model for either: nothing records which documents a resident is
 * expected to provide, and `Document.createdById` is a `User` FK, so a resident
 * (who has no user row) cannot be the author of one. Both are absent here
 * rather than faked, and are reported as missing product rather than missing
 * code.
 */

const CATEGORY_LABELS: Record<string, string> = {
  CONTRACT: 'הסכמים',
  ID_DOCUMENT: 'מסמכי זהות',
  LAND_REGISTRY: 'מסמכי נכס',
  POWER_OF_ATTORNEY: 'ייפויי כוח',
  PLANNING: 'תכנון',
  ENGINEERING: 'הנדסה',
  FINANCIAL: 'מסמכים פיננסיים',
  MUNICIPALITY: 'עירייה',
  MARKETING: 'שיווק',
  MEETING_MINUTES: 'פרוטוקולים',
  LEGAL: 'משפטי',
  PERMIT: 'היתרים',
  OTHER: 'אחר',
}

/** The order categories appear in. Anything unlisted follows, alphabetically. */
const CATEGORY_ORDER = [
  'CONTRACT', 'POWER_OF_ATTORNEY', 'ID_DOCUMENT', 'LAND_REGISTRY',
  'MEETING_MINUTES', 'PLANNING', 'PERMIT', 'MUNICIPALITY',
  'ENGINEERING', 'FINANCIAL', 'LEGAL', 'MARKETING', 'OTHER',
]

/** Signature states that mean "nothing is being asked of you any more". */
const CLOSED_SIGNATURE_STATES = ['SIGNED', 'REJECTED', 'EXPIRED']

export interface PortalDocument {
  id: string
  title: string
  category: string
  categoryLabel: string
  fileName: string
  mimeType: string
  fileSize: number
  sharedAt: Date
  /** How this resident came to be entitled to it. */
  sources: ('SHARED' | 'SIGNATURE')[]
  signature: {
    required: boolean
    signed: boolean
    signedAt: Date | null
    status: string
  } | null
  /** False for a metadata-only record with no object behind it. */
  downloadable: boolean
}

@Injectable()
export class PortalDocumentsService {
  private readonly logger = new Logger(PortalDocumentsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Columns safe to hand a resident.
   *
   * `s3Key` and `s3Bucket` are absent for the same reason they are absent from
   * the staff endpoint: the storage key is a capability — it is all
   * `getSignedUrl` needs — and it must not leave the server. Downloads go
   * through the download route, which re-checks entitlement.
   */
  private static readonly DOCUMENT_FIELDS = {
    id: true, title: true, category: true, status: true,
    fileName: true, mimeType: true, fileSize: true, s3Key: true,
    createdAt: true,
  } as const

  async list(scope: PortalScope) {
    const [shared, forSignature] = await Promise.all([
      this.prisma.residentDocument.findMany({
        where: {
          residentId: scope.residentId,
          document: {
            tenantId: scope.tenantId,
            isLatest: true,
            // ARCHIVED is an explicit withdrawal. DRAFT is NOT filtered: it is
            // the column's default value, so almost every row carries it, and
            // treating a default as a signal would hide nearly everything.
            // Attaching the document is the decision that matters.
            status: { not: 'ARCHIVED' },
          },
        },
        select: {
          addedAt: true,
          document: { select: PortalDocumentsService.DOCUMENT_FIELDS },
        },
        orderBy: { addedAt: 'desc' },
      }),
      this.prisma.signatureRequest.findMany({
        where: {
          residentId: scope.residentId,
          tenantId: scope.tenantId,
          documentId: { not: null },
          document: { isLatest: true, status: { not: 'ARCHIVED' } },
        },
        select: {
          status: true, signedAt: true, createdAt: true,
          document: { select: PortalDocumentsService.DOCUMENT_FIELDS },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    // One document can arrive by both routes — attached, and then sent for
    // signature. It is one row on the page, carrying both reasons.
    const byId = new Map<string, PortalDocument>()

    for (const row of shared) {
      byId.set(row.document.id, this.toPortalDocument(row.document, row.addedAt, ['SHARED'], null))
    }

    for (const row of forSignature) {
      const doc = row.document!
      const signature = {
        required: !CLOSED_SIGNATURE_STATES.includes(row.status),
        signed: row.status === 'SIGNED',
        signedAt: row.signedAt,
        status: row.status,
      }
      const existing = byId.get(doc.id)
      if (existing) {
        existing.sources.push('SIGNATURE')
        // The signature request is the more specific fact about a document
        // that arrived both ways, so it wins.
        existing.signature = signature
        continue
      }
      byId.set(doc.id, this.toPortalDocument(doc, row.createdAt, ['SIGNATURE'], signature))
    }

    const documents = [...byId.values()]
    return {
      counts: {
        total: documents.length,
        awaitingSignature: documents.filter((d) => d.signature?.required).length,
        signed: documents.filter((d) => d.signature?.signed).length,
      },
      categories: groupByCategory(documents),
    }
  }

  /**
   * A short-lived download URL, for a document this resident is entitled to.
   *
   * ── THE FIRST PORTAL ROUTE THAT TAKES AN ID ─────────────────────────────
   *
   * So it follows the rule the controller states: the id is not validated
   * against the caller's entitlement after the fact — it is used INSIDE a query
   * that is already scoped to the session. A document belonging to someone else
   * simply does not match, and the answer is 404 rather than a 403. A 403 would
   * confirm that the id exists somewhere, which is a fact a resident is not
   * entitled to learn by probing.
   *
   * `StorageService.getSignedUrl` then refuses any key not prefixed with the
   * tenant id, so a document row whose key somehow points elsewhere cannot mint
   * a URL either. Two independent checks, neither relying on the other.
   */
  async downloadUrl(scope: PortalScope, documentId: string) {
    const doc = await this.prisma.document.findFirst({
      where: {
        id: documentId,
        tenantId: scope.tenantId,
        status: { not: 'ARCHIVED' },
        OR: [
          { residentDocuments: { some: { residentId: scope.residentId } } },
          { signatureRequests: { some: { residentId: scope.residentId, tenantId: scope.tenantId } } },
        ],
      },
      select: { id: true, s3Key: true, fileName: true, mimeType: true },
    })

    if (!doc) {
      this.logger.warn(
        `Resident ${scope.residentId} asked for document ${documentId}, which is not theirs — 404.`,
      )
      throw new NotFoundException({ code: 'DOCUMENT_NOT_FOUND', message: 'המסמך לא נמצא' })
    }

    // A metadata-only record has no object behind it. Minting a URL to nothing
    // would produce a broken download rather than an honest error.
    if (!doc.s3Key) {
      throw new NotFoundException({
        code: 'DOCUMENT_HAS_NO_FILE',
        message: 'למסמך זה לא צורף קובץ',
      })
    }

    const url = await this.storage.getSignedUrl(scope.tenantId, doc.s3Key)
    return { url, expiresIn: 900, fileName: doc.fileName, mimeType: doc.mimeType }
  }

  private toPortalDocument(
    doc: {
      id: string; title: string; category: string; fileName: string
      mimeType: string; fileSize: number; s3Key: string
    },
    sharedAt: Date,
    sources: ('SHARED' | 'SIGNATURE')[],
    signature: PortalDocument['signature'],
  ): PortalDocument {
    return {
      id: doc.id,
      title: doc.title,
      category: doc.category,
      categoryLabel: CATEGORY_LABELS[doc.category] ?? doc.category,
      fileName: doc.fileName,
      mimeType: doc.mimeType,
      fileSize: doc.fileSize,
      sharedAt,
      sources,
      signature,
      downloadable: Boolean(doc.s3Key),
    }
  }
}

/** Groups into the order a resident would look for things, newest first inside each. */
function groupByCategory(documents: PortalDocument[]) {
  const groups = new Map<string, PortalDocument[]>()
  for (const doc of documents) {
    const bucket = groups.get(doc.category) ?? []
    bucket.push(doc)
    groups.set(doc.category, bucket)
  }

  return [...groups.entries()]
    .sort(([a], [b]) => {
      const ia = CATEGORY_ORDER.indexOf(a)
      const ib = CATEGORY_ORDER.indexOf(b)
      // Anything not in the list sorts after everything that is.
      return (ia < 0 ? CATEGORY_ORDER.length : ia) - (ib < 0 ? CATEGORY_ORDER.length : ib)
        || a.localeCompare(b)
    })
    .map(([category, docs]) => ({
      category,
      label: CATEGORY_LABELS[category] ?? category,
      documents: docs.sort((x, y) => y.sharedAt.getTime() - x.sharedAt.getTime()),
    }))
}
