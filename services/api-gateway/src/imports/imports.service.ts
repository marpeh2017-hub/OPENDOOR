import { Injectable, Logger } from '@nestjs/common'
import {
  ImportDecisionAction, ImportEntityType, ImportJobStatus, ImportMode,
  ImportRowOutcome, ImportIssueSeverity, Prisma,
} from '@prisma/client'
import { PrismaService } from '../prisma.service'
import { StorageService } from '../storage/storage.service'
import { TenantScopeService } from '../common/tenant/tenant-scope.service'
import { OwnershipService, type OwnershipAssignment, type ApartmentOwnershipPlan } from '../common/ownership/ownership.service'
import { AuditService, type AuditActor } from '../common/audit/audit.service'
import { DomainError } from '../common/errors/domain-error'
import { OwnersService, type OwnerImportRow } from '../owners/owners.service'
import { ResidentsService, type ResidentImportRow } from '../residents/residents.service'
import { ExcelParserService, type ParsedSheet } from './excel-parser.service'
import {
  ImportValidationService, type ResolvedMapping, type ValidatedRow,
  type ProjectIndexForImport, type RowDecision,
} from './import-validation.service'
import {
  suggestMapping, fieldsFor, isSensitiveField, AMBIGUOUS_BELOW,
  type ImportFieldKey,
} from './import-fields'
import {
  ALLOWED_IMPORT_EXTENSIONS, ALLOWED_IMPORT_MIME_TYPES, IMPORT_ERRORS,
  MAX_IMPORT_BYTES, REFUSED_IMPORT_EXTENSIONS, extensionOf, looksLikeXlsx,
  sanitizeImportFileName,
} from './excel-import.constants'
import type { ConfirmMappingDto, CommitImportDto, ResolveReviewDto } from './dto/import.dto'

/**
 * Excel import orchestration.
 *
 * The workflow is deliberately staged, and each stage RE-READS the stored
 * workbook rather than trusting a cached parse:
 *
 *   upload  → store bytes + parse headers + SUGGEST a mapping   (status UPLOADED)
 *   mapping → user confirms/overrides; nothing ambiguous passes (status MAPPED)
 *   preview → validate every row against LIVE data             (status PREVIEWED)
 *   commit  → one transaction; all-or-nothing                  (status COMPLETED/FAILED)
 *
 * Re-reading matters: a preview generated ten minutes ago may name an owner
 * that a colleague has since created manually. Re-validating at commit means
 * the duplicate check that guards the write is the one run against the data as
 * it is at the moment of writing, not as it was at preview time.
 */
@Injectable()
export class ImportsService {
  private readonly logger = new Logger(ImportsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly scope: TenantScopeService,
    private readonly ownership: OwnershipService,
    private readonly audit: AuditService,
    private readonly owners: OwnersService,
    private readonly residents: ResidentsService,
    private readonly parser: ExcelParserService,
    private readonly validation: ImportValidationService,
  ) {}

  // ── 1. Upload ─────────────────────────────────────────────────────────────

  async upload(
    file: UploadedFileLike | undefined,
    dto: { projectId: string; entityType: ImportEntityType; mode?: ImportMode },
    actor: AuditActor,
  ) {
    this.assertUploadable(file)
    // Resolve the project INSIDE the tenant first. A projectId belonging to
    // another tenant is a 404 here and the file is never even stored.
    await this.scope.assertProject(dto.projectId, actor.tenantId)

    const fileName = sanitizeImportFileName(file!.originalname)

    // Parse BEFORE storing: a file we cannot read should not leave an object in
    // the bucket for a job that can never proceed.
    const sheet = await this.parser.parse(file!.buffer)

    // ENCRYPTED AT REST. The workbook is retained permanently and holds
    // national IDs in plaintext cells — storing it unencrypted would undercut
    // the encrypted `Owner.nationalId` column it feeds. `{ encrypt: true }` is
    // opt-in precisely so the document library (which serves signed URLs the
    // API never proxies) is not affected; see `StorageService.getSignedUrl`.
    // Every read goes through `StorageService.download`, which decrypts from
    // the object's own header.
    const storageKey = await this.storage.upload(
      actor.tenantId, 'imports', fileName, file!.buffer,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      { encrypt: true },
    )

    const suggestions = suggestMapping(sheet.headers, dto.entityType)
    const mapping: Record<string, unknown> = {}
    for (const s of suggestions) {
      if (s.field == null) continue
      mapping[s.field] = {
        index: s.index, column: s.column,
        confidence: (s as any).confidence, source: 'AUTO',
      }
    }

    const job = await this.prisma.importJob.create({
      data: {
        tenantId: actor.tenantId,
        projectId: dto.projectId,
        createdById: actor.userId,
        entityType: dto.entityType,
        mode: dto.mode ?? ImportMode.ADD_AND_UPDATE,
        status: ImportJobStatus.UPLOADED,
        fileName,
        fileSize: file!.size,
        storageKey,
        sheetName: sheet.sheetName,
        sheetHeaders: sheet.headers,
        columnMapping: mapping as Prisma.InputJsonValue,
        totalRows: sheet.rows.length,
      },
      select: JOB_PUBLIC_SELECT,
    })

    await this.audit.record(actor, {
      action: 'CREATE', entity: 'ImportJob', entityId: job.id,
      // The file NAME is auditable; its contents are not summarised here.
      changes: { after: { fileName, entityType: dto.entityType, totalRows: sheet.rows.length } },
      metadata: { projectId: dto.projectId },
    })

    return {
      job,
      sheet: {
        sheetName: sheet.sheetName,
        availableSheets: sheet.availableSheets,
        headers: sheet.headers,
        totalRows: sheet.rows.length,
      },
      mapping: this.describeMapping(suggestions, dto.entityType),
      fields: fieldsFor(dto.entityType).map((f) => ({
        key: f.key, label: f.label, required: f.required, sensitive: Boolean(f.sensitive),
      })),
      /** First few rows, PII-masked, so the user can sanity-check the mapping. */
      sample: this.sampleRows(sheet, dto.entityType, suggestions),
    }
  }

  // ── 2. Mapping ────────────────────────────────────────────────────────────

  /**
   * Accepts the user's mapping and moves the job to MAPPED.
   *
   * Refuses when a REQUIRED field is unmapped, and — the point of the whole
   * step — refuses when a low-confidence suggestion has not been explicitly
   * confirmed. `source: 'USER'` on a mapping entry is that confirmation; the
   * CRM sets it when the user accepts or changes a row in the mapping table.
   */
  async confirmMapping(id: string, dto: ConfirmMappingDto, actor: AuditActor) {
    const job = await this.loadJob(id, actor.tenantId)
    this.assertStatus(job.status, [
      ImportJobStatus.UPLOADED, ImportJobStatus.MAPPED, ImportJobStatus.PREVIEWED,
    ])

    const defs = fieldsFor(job.entityType)
    const validKeys = new Set(defs.map((d) => d.key as string))
    const headerCount = job.sheetHeaders.length

    const mapping: ResolvedMapping = {}
    const seenIndexes = new Map<number, string>()

    for (const entry of dto.mapping) {
      if (!validKeys.has(entry.field)) {
        throw DomainError.validation(
          'IMPORT_UNKNOWN_FIELD', `השדה "${entry.field}" אינו שדה ייבוא מוכר.`, entry.field,
        )
      }
      if (entry.index < 0 || entry.index >= headerCount) {
        throw DomainError.validation(
          'IMPORT_COLUMN_OUT_OF_RANGE',
          `העמודה שנבחרה עבור "${entry.field}" אינה קיימת בגיליון.`, entry.field,
        )
      }
      const clash = seenIndexes.get(entry.index)
      if (clash) {
        throw DomainError.validation(
          'IMPORT_COLUMN_REUSED',
          `העמודה "${job.sheetHeaders[entry.index]}" שויכה גם ל-"${clash}" וגם ל-"${entry.field}".`,
          entry.field,
        )
      }
      seenIndexes.set(entry.index, entry.field)
      mapping[entry.field as ImportFieldKey] = {
        index: entry.index,
        column: job.sheetHeaders[entry.index],
        confidence: 1,
        source: 'USER',
      }
    }

    const missing = defs.filter((d) => d.required && !mapping[d.key])
    if (missing.length) {
      throw new DomainError('VALIDATION', missing.map((d) => ({
        code: 'IMPORT_REQUIRED_FIELD_UNMAPPED',
        message: `חובה לשייך עמודה לשדה "${d.label}".`,
        path: d.key,
      })))
    }

    const updated = await this.prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: ImportJobStatus.MAPPED,
        mode: dto.mode ?? job.mode,
        columnMapping: Object.fromEntries(
          Object.entries(mapping).map(([k, v]) => [k, { ...v }]),
        ) as Prisma.InputJsonValue,
      },
      select: JOB_PUBLIC_SELECT,
    })

    await this.audit.record(actor, {
      action: 'UPDATE', entity: 'ImportJob', entityId: job.id,
      changes: { after: { status: ImportJobStatus.MAPPED, mode: updated.mode } },
      metadata: { mappedFields: Object.keys(mapping) },
    })

    return updated
  }

  // ── 3. Preview ────────────────────────────────────────────────────────────

  /**
   * Validates every row and returns the preview. Writes nothing to the domain
   * tables; it does persist the row issues so the error report is downloadable
   * before the user commits (they often fix the sheet and re-upload instead).
   */
  async preview(id: string, actor: AuditActor, opts: { page?: number; pageSize?: number } = {}) {
    const job = await this.loadJob(id, actor.tenantId)
    this.assertStatus(job.status, [ImportJobStatus.MAPPED, ImportJobStatus.PREVIEWED])

    const { sheet, mapping } = await this.reread(job, actor.tenantId)
    const { rows, index } = await this.validation.validate({
      sheet, mapping,
      entityType: job.entityType, mode: job.mode,
      projectId: job.projectId, tenantId: actor.tenantId,
      decisions: await this.loadDecisions(job.id),
    })

    // Ownership arithmetic runs on the PROPOSED end-state, through the shared
    // service — the same call the commit will make — so the preview shows the
    // real share-sum warnings rather than a separate estimate of them.
    const ownershipIssues = job.entityType === ImportEntityType.OWNER
      ? this.checkOwnershipPlans(rows, index)
      : new Map<number, OwnershipRowIssue[]>()

    const byRow = new Map(rows.map((r) => [r.rowNumber, r]))
    for (const [rowNumber, issues] of ownershipIssues) {
      const row = byRow.get(rowNumber)
      if (!row) continue
      for (const i of issues) {
        row.issues.push({
          // Carry the shared service's OWN severity. Flattening an
          // OWNERSHIP_SHARE_SUM_EXCEEDS_ONE to a warning here would show the
          // user a preview that says "will import" for a batch the commit is
          // then guaranteed to reject — the preview must agree with the rule.
          severity: i.severity === 'ERROR'
            ? ImportIssueSeverity.ERROR
            : ImportIssueSeverity.WARNING,
          field: 'share',
          code: i.code,
          message: i.message,
          suggestion: 'בדקו את חלקי הבעלות של כל בעלי הדירה.',
        })
      }
    }

    // A row that just gained an ownership ERROR is no longer importable, so its
    // outcome has to be recomputed. The share sums of the REMAINING rows shift
    // as a result; we do not iterate to a fixed point here because the commit
    // re-runs `applyPlans`, which is the authoritative check and rolls the whole
    // import back if anything still violates. The preview's job is to show the
    // user the first, actionable error — not to simulate the transaction.
    for (const row of rows) {
      if (row.hasError() && row.outcome !== ImportRowOutcome.INVALID) {
        row.outcome = ImportRowOutcome.INVALID
      }
    }

    const counts = tally(rows)
    await this.persistIssues(job.id, rows, counts)

    await this.prisma.importJob.update({
      where: { id: job.id },
      data: { status: ImportJobStatus.PREVIEWED, totalRows: rows.length },
    })

    const page = Math.max(1, opts.page ?? 1)
    const pageSize = Math.min(500, Math.max(1, opts.pageSize ?? 100))
    const start = (page - 1) * pageSize

    return {
      jobId: job.id,
      status: ImportJobStatus.PREVIEWED,
      mode: job.mode,
      entityType: job.entityType,
      totalRows: rows.length,
      counts,
      page, pageSize,
      rows: rows.slice(start, start + pageSize).map((r) => this.describeRow(r, index, job.entityType)),
    }
  }

  // ── 4. Commit ─────────────────────────────────────────────────────────────

  /**
   * Applies the import in ONE transaction.
   *
   * TRANSACTION SHAPE AND WHY
   * -------------------------
   * Everything — owner/resident writes, `OwnerApartment` replacement, the audit
   * rows and the job's final counters — happens inside a single
   * `prisma.$transaction`. Ownership is the reason this is not negotiable: a
   * partial apartment write leaves shares summing to something other than 1,
   * which silently moves the legally consequential signature threshold. There
   * is no state in which "some of the apartments imported".
   *
   * A row-level ERROR does NOT abort the run — invalid rows are excluded from
   * the batch, recorded as failures and reported. What aborts the run is a
   * violation the shared services raise about the data we were about to write
   * (a duplicate national ID appearing between preview and commit, a share sum
   * exceeding 1, an apartment that vanished). Those roll everything back and
   * the job is marked FAILED with nothing written.
   *
   * Re-uploading the same file is safe: matched rows resolve to UPDATE, so the
   * second run updates in place rather than creating a second owner.
   */
  async commit(id: string, dto: CommitImportDto, actor: AuditActor) {
    const job = await this.loadJob(id, actor.tenantId)
    this.assertStatus(job.status, [ImportJobStatus.PREVIEWED, ImportJobStatus.MAPPED])

    const startedAt = new Date()
    await this.prisma.importJob.update({
      where: { id: job.id },
      data: { status: ImportJobStatus.IMPORTING, startedAt },
    })

    try {
      const { sheet, mapping } = await this.reread(job, actor.tenantId)
      // Re-validate against LIVE data. This, not the preview, is the check that
      // guards the write.
      const { rows, index } = await this.validation.validate({
        sheet, mapping,
        entityType: job.entityType,
        mode: dto.mode ?? job.mode,
        projectId: job.projectId,
        tenantId: actor.tenantId,
        // The rulings are re-applied here against a FRESH candidate set, not
        // replayed from the preview. A ruling whose target has since stopped
        // being a candidate turns its row into an error rather than writing.
        decisions: await this.loadDecisions(job.id),
      })

      const writable = rows.filter((r) => r.willWrite())
      const counts = tally(rows)

      if (!writable.length) {
        await this.persistIssues(job.id, rows, counts)
        const finished = await this.finish(job.id, ImportJobStatus.COMPLETED, counts, startedAt)
        return { job: finished, counts }
      }

      const result = await this.prisma.$transaction(async (tx) => {
        if (job.entityType === ImportEntityType.OWNER) {
          return this.commitOwners(job.id, job.projectId, writable, index, actor, tx)
        }
        return this.commitResidents(job.id, writable, actor, tx)
      }, {
        // A 5,000-row sheet does real work; the default 5s interactive timeout
        // is not enough and a timeout mid-flight would roll back a legitimate
        // import. Measured timings are in the report.
        timeout: 120_000,
        maxWait: 20_000,
      })

      await this.persistIssues(job.id, rows, counts)
      const finished = await this.finish(job.id, ImportJobStatus.COMPLETED, {
        ...counts, created: result.created, updated: result.updated,
      }, startedAt)

      await this.audit.record(actor, {
        action: 'CREATE', entity: 'ImportJob', entityId: job.id,
        changes: { after: { status: 'COMPLETED', created: result.created, updated: result.updated } },
        metadata: {
          projectId: job.projectId, entityType: job.entityType,
          fileName: job.fileName, apartmentsTouched: result.apartmentsTouched,
        },
      })

      return { job: finished, counts: { ...counts, created: result.created, updated: result.updated } }
    } catch (err) {
      // NOTHING was written — the transaction rolled back. Record why, in a
      // form safe to display: a DomainError's Hebrew details are PII-free by
      // construction; anything else is reduced to a generic message so an
      // internal error string cannot reach the UI.
      const reason = err instanceof DomainError
        ? err.details.map((d) => (d.path ? `שורה ${d.path}: ${d.message}` : d.message)).join(' | ').slice(0, 1000)
        : 'הייבוא נכשל בשל שגיאה בלתי צפויה. לא בוצע שום שינוי בנתונים.'

      if (!(err instanceof DomainError)) {
        this.logger.error(`Import ${job.id} failed: ${(err as Error)?.name ?? 'unknown'}`)
      }

      await this.prisma.importJob.update({
        where: { id: job.id },
        data: {
          status: ImportJobStatus.FAILED,
          failureReason: reason,
          finishedAt: new Date(),
          durationMs: Date.now() - startedAt.getTime(),
          createdRows: 0, updatedRows: 0,
        },
      })
      throw err
    }
  }

  /**
   * Owner commit: identities first, then ownership.
   *
   * The two are separate because `OwnerApartment` has exactly one writer in
   * this codebase — `OwnershipService.applyPlans` — and it needs owner ids that
   * do not exist until the first half has run. Both halves share the caller's
   * transaction, so they still succeed or fail together.
   */
  private async commitOwners(
    jobId: string,
    projectId: string,
    rows: ValidatedRow[],
    index: ProjectIndexForImport,
    actor: AuditActor,
    tx: Prisma.TransactionClient,
  ) {
    const batchRows: OwnerImportRow[] = rows.map((r) => ({
      ref: String(r.rowNumber),
      existingOwnerId: r.outcome === ImportRowOutcome.UPDATE ? r.match!.entityId : null,
      fullName: r.values.fullName,
      nationalId: r.values.nationalId,
      phone: r.values.phone,
      email: r.values.email,
      addressAbroad: r.values.addressAbroad,
      isEstate: r.values.isEstate,
      notes: r.values.notes,
    }))

    const { created, updated, ownerIdByRef } =
      await this.owners.applyImportBatch({ jobId, rows: batchRows }, actor, tx)

    const plans = this.buildOwnershipPlans(rows, ownerIdByRef, index)
    if (plans.length) {
      // The single writer of OwnerApartment. It re-validates every apartment's
      // FULL share set exactly (BigInt, no epsilon) and throws if any would
      // exceed 1, rolling the whole import back.
      await this.ownership.applyPlans(plans, actor, { tx })
    }

    void projectId
    return { created, updated, apartmentsTouched: plans.length }
  }

  private async commitResidents(
    jobId: string,
    rows: ValidatedRow[],
    actor: AuditActor,
    tx: Prisma.TransactionClient,
  ) {
    const batchRows: ResidentImportRow[] = rows.map((r) => ({
      ref: String(r.rowNumber),
      existingResidentId: r.outcome === ImportRowOutcome.UPDATE ? r.match!.entityId : null,
      apartmentId: r.apartmentId!,
      firstName: r.values.firstName,
      lastName: r.values.lastName,
      nationalId: r.values.nationalId,
      phone: r.values.phone,
      phone2: r.values.phone2,
      email: r.values.email,
      notes: r.values.notes,
    }))
    const { created, updated } =
      await this.residents.applyImportBatch({ jobId, rows: batchRows }, actor, tx)
    return { created, updated, apartmentsTouched: 0 }
  }

  /**
   * Merges the sheet's holdings into each apartment's EXISTING ownership.
   *
   * `applyPlans` is a REPLACE, so a plan must describe the apartment's complete
   * intended end state. For every apartment the sheet touches we therefore take
   * the current holdings, drop the owners the sheet re-states, and append the
   * imported ones. Co-owners the sheet does not mention keep their shares —
   * importing one heir must not silently delete the other two.
   *
   * A row with no share cell defaults to 1/1. If the apartment already has
   * other owners, that pushes the sum past 1 and `applyPlans` rejects the
   * import — which is correct, and is why the missing-share warning at
   * validation time tells the user to add the column.
   */
  private buildOwnershipPlans(
    rows: ValidatedRow[],
    ownerIdByRef: Map<string, string>,
    index: ProjectIndexForImport,
  ): ApartmentOwnershipPlan[] {
    const byApartment = new Map<string, { ownerId: string; share: { shareNumerator: number; shareDenominator: number }; viaInheritance: boolean }[]>()

    for (const r of rows) {
      if (!r.apartmentId) continue
      const ownerId = ownerIdByRef.get(String(r.rowNumber))
      if (!ownerId) continue
      const share = r.values.share ?? { shareNumerator: 1, shareDenominator: 1 }
      const list = byApartment.get(r.apartmentId) ?? []
      list.push({ ownerId, share, viaInheritance: r.values.viaInheritance ?? false })
      byApartment.set(r.apartmentId, list)
    }

    const plans: ApartmentOwnershipPlan[] = []
    for (const [apartmentId, incoming] of byApartment) {
      const imported = new Set(incoming.map((i) => i.ownerId))
      const kept = (index.existingLinks.get(apartmentId) ?? [])
        .filter((h) => !imported.has(h.ownerId))
        .map<OwnershipAssignment>((h) => ({
          ownerId: h.ownerId,
          shareNumerator: h.shareNumerator,
          shareDenominator: h.shareDenominator,
          viaInheritance: h.viaInheritance,
        }))

      const assignments: OwnershipAssignment[] = [
        ...kept,
        ...incoming.map<OwnershipAssignment>((i) => ({
          ownerId: i.ownerId,
          shareNumerator: i.share.shareNumerator,
          shareDenominator: i.share.shareDenominator,
          viaInheritance: i.viaInheritance,
        })),
      ]
      plans.push({
        apartmentId, assignments,
        ref: index.apartmentLabels.get(apartmentId) ?? apartmentId,
      })
    }
    return plans
  }

  /**
   * Dry-run of the ownership arithmetic for the preview.
   *
   * Uses `OwnershipService.validatePlans` — the exact same pure function the
   * commit's `applyPlans` calls — with placeholder owner ids for rows that
   * would create a new owner. Placeholders are fine because `validatePlans`
   * only checks shape and arithmetic; the id existence check is `assertReferences`,
   * which runs for real inside the transaction.
   */
  private checkOwnershipPlans(
    rows: ValidatedRow[],
    index: ProjectIndexForImport,
  ): Map<number, OwnershipRowIssue[]> {
    const placeholder = new Map<string, string>()
    for (const r of rows) {
      if (!r.willWrite()) continue
      placeholder.set(
        String(r.rowNumber),
        r.outcome === ImportRowOutcome.UPDATE ? r.match!.entityId : `new:${r.rowNumber}`,
      )
    }
    const plans = this.buildOwnershipPlans(
      rows.filter((r) => r.willWrite()), placeholder, index,
    )
    if (!plans.length) return new Map()

    const report = this.ownership.validatePlans(plans)
    const out = new Map<number, OwnershipRowIssue[]>()
    if (!report.issues.length) return out

    // Map an apartment-level issue back onto every sheet row for that apartment
    // — the user needs to see it on the line they can edit.
    for (const issue of report.issues) {
      for (const r of rows) {
        if (r.apartmentId !== issue.apartmentId || !r.willWrite()) continue
        const list = out.get(r.rowNumber) ?? []
        list.push({ severity: issue.severity, code: issue.code, message: issue.message })
        out.set(r.rowNumber, list)
      }
    }
    return out
  }

  // ── History, detail, cancel ───────────────────────────────────────────────

  async list(tenantId: string, filters: { projectId?: string; status?: ImportJobStatus } = {}) {
    return this.prisma.importJob.findMany({
      where: {
        tenantId,
        ...(filters.projectId ? { projectId: filters.projectId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      select: {
        ...JOB_PUBLIC_SELECT,
        project: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { issues: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
  }

  async findOne(id: string, tenantId: string) {
    const job = await this.prisma.importJob.findFirst({
      where: { id, tenantId },
      select: {
        ...JOB_PUBLIC_SELECT,
        project: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    })
    if (!job) throw DomainError.notFound('IMPORT_JOB_NOT_FOUND', 'עבודת הייבוא לא נמצאה.')
    return job
  }

  async issues(id: string, tenantId: string, opts: { severity?: ImportIssueSeverity } = {}) {
    await this.loadJob(id, tenantId)
    return this.prisma.importRowIssue.findMany({
      where: { jobId: id, ...(opts.severity ? { severity: opts.severity } : {}) },
      orderBy: [{ rowNumber: 'asc' }, { createdAt: 'asc' }],
      take: 5000,
    })
  }

  // ── Ambiguous-duplicate resolution queue ──────────────────────────────────

  /**
   * The rows awaiting a human ruling, each with the imported values beside
   * EVERY plausible existing record and the reason they matched.
   *
   * Re-validates rather than reading the persisted issues. `ImportRowIssue`
   * stores only the matcher's first-guess `matchedEntityId`, not the full
   * candidate list, and — more importantly — the candidate list is a fact about
   * live data that can change after a preview. Showing a stale list would let
   * the user rule on a record that no longer exists, which the commit would
   * then reject. Same re-read discipline as every other step here.
   *
   * PII: existing records are described by name/phone/email — the same fields
   * the preview already returns to this role — and the imported side reports
   * only WHETHER a national ID is present, never its digits.
   */
  async review(id: string, actor: AuditActor) {
    const job = await this.loadJob(id, actor.tenantId)
    this.assertStatus(job.status, [
      ImportJobStatus.MAPPED, ImportJobStatus.PREVIEWED,
    ])

    const { sheet, mapping } = await this.reread(job, actor.tenantId)
    const decisions = await this.loadDecisions(job.id)

    // Validate WITHOUT the decisions so every originally-ambiguous row is
    // still listed — otherwise a row the user already ruled on would vanish
    // from the queue and could never be changed.
    const { rows, index } = await this.validation.validate({
      sheet, mapping,
      entityType: job.entityType, mode: job.mode,
      projectId: job.projectId, tenantId: actor.tenantId,
    })

    const pending = rows.filter(
      (r) => r.outcome === ImportRowOutcome.NEEDS_REVIEW && r.match?.ambiguous,
    )

    return {
      jobId: job.id,
      entityType: job.entityType,
      mode: job.mode,
      totalAmbiguous: pending.length,
      undecided: pending.filter((r) => !decisions.has(r.rowNumber)).length,
      rows: pending.map((r) => {
        const decision = decisions.get(r.rowNumber)
        return {
          rowNumber: r.rowNumber,
          apartmentLabel: r.apartmentId
            ? index.apartmentLabels.get(r.apartmentId) ?? null
            : null,
          matchReason: r.match!.reason,
          imported: {
            name: job.entityType === ImportEntityType.OWNER
              ? r.values.fullName ?? ''
              : `${r.values.firstName ?? ''} ${r.values.lastName ?? ''}`.trim(),
            phone: r.values.phone ?? null,
            email: r.values.email ?? null,
            // Presence only — the digits never leave the server.
            hasNationalId: Boolean(r.values.nationalId),
            share: r.values.share
              ? `${r.values.share.shareNumerator}/${r.values.share.shareDenominator}`
              : null,
          },
          candidates: r.match!.candidateIds.map((entityId) =>
            this.describeCandidate(entityId, index, job.entityType),
          ),
          decision: decision
            ? { action: decision.action, targetEntityId: decision.targetEntityId ?? null }
            : null,
        }
      }),
    }
  }

  /**
   * Records the user's rulings. Writes nothing to the domain tables — the
   * rulings take effect at the next preview/commit, where they are re-checked
   * against live data.
   *
   * Every ruling is validated here as well, so an impossible one is rejected at
   * the point the user makes it rather than surfacing as a failed row later:
   *   - the row must currently be an ambiguous NEEDS_REVIEW row of THIS job
   *   - UPDATE_EXISTING must name an id in that row's live candidate list,
   *     which is also the tenant-isolation check (the candidate list is built
   *     from tenant-scoped queries, so another tenant's id is simply not in it)
   *   - UPDATE_EXISTING requires a target; the other two actions forbid one
   */
  async resolve(id: string, dto: ResolveReviewDto, actor: AuditActor) {
    const job = await this.loadJob(id, actor.tenantId)
    this.assertStatus(job.status, [ImportJobStatus.MAPPED, ImportJobStatus.PREVIEWED])

    const { sheet, mapping } = await this.reread(job, actor.tenantId)
    const { rows } = await this.validation.validate({
      sheet, mapping,
      entityType: job.entityType, mode: job.mode,
      projectId: job.projectId, tenantId: actor.tenantId,
    })

    const ambiguous = new Map(
      rows
        .filter((r) => r.outcome === ImportRowOutcome.NEEDS_REVIEW && r.match?.ambiguous)
        .map((r) => [r.rowNumber, r.match!.candidateIds]),
    )

    const seen = new Set<number>()
    for (const d of dto.decisions) {
      if (seen.has(d.rowNumber)) {
        throw DomainError.validation(
          'IMPORT_DECISION_DUPLICATE_ROW',
          `שורה ${d.rowNumber} מופיעה יותר מפעם אחת ברשימת ההכרעות.`,
        )
      }
      seen.add(d.rowNumber)

      const candidates = ambiguous.get(d.rowNumber)
      if (!candidates) {
        throw DomainError.validation(
          'IMPORT_DECISION_ROW_NOT_AMBIGUOUS',
          `שורה ${d.rowNumber} אינה ממתינה להכרעה.`,
        )
      }

      if (d.action === ImportDecisionAction.UPDATE_EXISTING) {
        if (!d.targetEntityId) {
          throw DomainError.validation(
            'IMPORT_DECISION_TARGET_REQUIRED',
            `יש לבחור רשומה קיימת עבור שורה ${d.rowNumber}.`,
          )
        }
        // Also the tenant check: candidateIds come from tenant-scoped queries.
        if (!candidates.includes(d.targetEntityId)) {
          throw DomainError.validation(
            'IMPORT_DECISION_TARGET_INVALID',
            `הרשומה שנבחרה עבור שורה ${d.rowNumber} אינה בין ההתאמות האפשריות.`,
          )
        }
      } else if (d.targetEntityId) {
        throw DomainError.validation(
          'IMPORT_DECISION_TARGET_NOT_ALLOWED',
          `אין לציין רשומה קיימת עבור שורה ${d.rowNumber} בפעולה שנבחרה.`,
        )
      }
    }

    await this.prisma.$transaction(
      dto.decisions.map((d) =>
        this.prisma.importRowDecision.upsert({
          where: { jobId_rowNumber: { jobId: job.id, rowNumber: d.rowNumber } },
          create: {
            jobId: job.id,
            rowNumber: d.rowNumber,
            action: d.action,
            targetEntityId: d.targetEntityId ?? null,
            note: d.note?.slice(0, 500) ?? null,
            decidedById: actor.userId,
          },
          update: {
            action: d.action,
            targetEntityId: d.targetEntityId ?? null,
            note: d.note?.slice(0, 500) ?? null,
            decidedById: actor.userId,
          },
        }),
      ),
    )

    await this.audit.record(actor, {
      action: 'UPDATE', entity: 'ImportJob', entityId: job.id,
      changes: {
        after: {
          // Row numbers and actions only — no sheet values, no names.
          resolvedRows: dto.decisions.map((d) => ({ row: d.rowNumber, action: d.action })),
        },
      },
      metadata: { projectId: job.projectId, decisionCount: dto.decisions.length },
    })

    return this.review(id, actor)
  }

  /** Clears a ruling so the row returns to the queue undecided. */
  async clearDecision(id: string, rowNumber: number, actor: AuditActor) {
    const job = await this.loadJob(id, actor.tenantId)
    this.assertStatus(job.status, [ImportJobStatus.MAPPED, ImportJobStatus.PREVIEWED])
    // Scoped by jobId, and the job was already resolved inside the tenant, so
    // this cannot reach another tenant's decision row.
    await this.prisma.importRowDecision.deleteMany({ where: { jobId: job.id, rowNumber } })
    await this.audit.record(actor, {
      action: 'UPDATE', entity: 'ImportJob', entityId: job.id,
      changes: { after: { clearedDecisionForRow: rowNumber } },
    })
    return this.review(id, actor)
  }

  async cancel(id: string, actor: AuditActor) {
    const job = await this.loadJob(id, actor.tenantId)
    this.assertStatus(job.status, [
      ImportJobStatus.UPLOADED, ImportJobStatus.MAPPED, ImportJobStatus.PREVIEWED,
    ])
    // Drop the stored workbook: an abandoned import should not leave a sheet of
    // national IDs sitting in the bucket indefinitely.
    if (job.storageKey) {
      await this.storage.delete(actor.tenantId, job.storageKey).catch(() => {
        this.logger.warn(`Could not delete import object for job ${job.id}`)
      })
    }
    const updated = await this.prisma.importJob.update({
      where: { id: job.id },
      data: { status: ImportJobStatus.CANCELLED, storageKey: null, finishedAt: new Date() },
      select: JOB_PUBLIC_SELECT,
    })
    await this.audit.record(actor, {
      action: 'UPDATE', entity: 'ImportJob', entityId: job.id,
      changes: { after: { status: 'CANCELLED' } },
    })
    return updated
  }

  /**
   * The downloadable error report, as CSV.
   *
   * UTF-8 BOM prefixed: without it Excel opens a Hebrew CSV in the legacy
   * codepage and every row is mojibake, which makes the report useless to the
   * person who needs it.
   *
   * `currentValue` was already masked at validation time for PII columns, so
   * this file cannot contain a national ID.
   */
  async errorReportCsv(id: string, tenantId: string): Promise<{ fileName: string; csv: string }> {
    const job = await this.loadJob(id, tenantId)
    const issues = await this.prisma.importRowIssue.findMany({
      where: { jobId: id },
      orderBy: [{ rowNumber: 'asc' }, { severity: 'asc' }],
      take: 20_000,
    })

    const header = ['שורה', 'חומרה', 'עמודה', 'שדה', 'קוד', 'תיאור', 'ערך בקובץ', 'תיקון מומלץ', 'תוצאה']
    const lines = [header.map(csvCell).join(',')]
    for (const i of issues) {
      lines.push([
        String(i.rowNumber),
        i.severity === ImportIssueSeverity.ERROR ? 'שגיאה' : 'אזהרה',
        i.column ?? '',
        i.field ?? '',
        i.code,
        i.message,
        i.currentValue ?? '',
        i.suggestion ?? '',
        outcomeHe(i.outcome),
      ].map(csvCell).join(','))
    }

    return {
      fileName: `import-errors-${job.id}.csv`,
      csv: '﻿' + lines.join('\r\n'),
    }
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private assertUploadable(file: UploadedFileLike | undefined): void {
    if (!file || !file.buffer) {
      throw DomainError.validation('IMPORT_FILE_MISSING', IMPORT_ERRORS.missingFile)
    }
    if (file.size === 0 || file.buffer.length === 0) {
      throw DomainError.validation('IMPORT_FILE_EMPTY', IMPORT_ERRORS.emptyFile)
    }
    if (file.size > MAX_IMPORT_BYTES) {
      throw DomainError.validation('IMPORT_FILE_TOO_LARGE', IMPORT_ERRORS.tooLarge)
    }

    const ext = extensionOf(file.originalname ?? '')
    const refusal = REFUSED_IMPORT_EXTENSIONS[ext]
    if (refusal) {
      throw DomainError.validation('IMPORT_FILE_TYPE_REFUSED', refusal)
    }
    if (!(ALLOWED_IMPORT_EXTENSIONS as readonly string[]).includes(ext)) {
      throw DomainError.validation('IMPORT_FILE_TYPE_INVALID', IMPORT_ERRORS.badType)
    }
    if (!(ALLOWED_IMPORT_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
      throw DomainError.validation('IMPORT_FILE_TYPE_INVALID', IMPORT_ERRORS.badType)
    }
    // Content check, independent of what the client claimed.
    if (!looksLikeXlsx(file.buffer)) {
      throw DomainError.validation('IMPORT_FILE_NOT_XLSX', IMPORT_ERRORS.notAZip)
    }
  }

  private async loadJob(id: string, tenantId: string) {
    const job = await this.prisma.importJob.findFirst({
      where: { id, tenantId },
      select: {
        id: true, tenantId: true, projectId: true, entityType: true, mode: true,
        status: true, fileName: true, storageKey: true, sheetName: true,
        sheetHeaders: true, columnMapping: true, totalRows: true,
      },
    })
    // Another tenant's job is indistinguishable from a job that does not exist.
    if (!job) throw DomainError.notFound('IMPORT_JOB_NOT_FOUND', 'עבודת הייבוא לא נמצאה.')
    return job
  }

  private assertStatus(actual: ImportJobStatus, allowed: ImportJobStatus[]): void {
    if (allowed.includes(actual)) return
    throw DomainError.conflict(
      'IMPORT_JOB_WRONG_STATUS',
      `לא ניתן לבצע את הפעולה כאשר מצב הייבוא הוא ${statusHe(actual)}.`,
    )
  }

  /** Re-reads the stored workbook and rebuilds the mapping from the job. */
  private async reread(job: { id: string; storageKey: string | null; sheetName: string | null; columnMapping: unknown }, tenantId: string) {
    if (!job.storageKey) {
      throw DomainError.conflict(
        'IMPORT_FILE_GONE',
        'קובץ הייבוא אינו זמין עוד. העלו אותו מחדש.',
      )
    }
    const buffer = await this.storage.download(tenantId, job.storageKey)
    const sheet = await this.parser.parse(buffer, job.sheetName ?? undefined)

    const raw = (job.columnMapping ?? {}) as Record<string, { index: number; column: string; confidence?: number; source?: string }>
    const mapping: ResolvedMapping = {}
    for (const [field, v] of Object.entries(raw)) {
      if (!v || typeof v.index !== 'number') continue
      mapping[field as ImportFieldKey] = {
        index: v.index,
        column: v.column ?? sheet.headers[v.index] ?? '',
        confidence: v.confidence ?? 1,
        source: (v.source === 'USER' ? 'USER' : 'AUTO'),
      }
    }
    return { sheet, mapping }
  }

  /** The persisted human rulings for a job, keyed by sheet row number. */
  private async loadDecisions(jobId: string): Promise<Map<number, RowDecision>> {
    const rows = await this.prisma.importRowDecision.findMany({
      where: { jobId },
      select: { rowNumber: true, action: true, targetEntityId: true },
    })
    return new Map(rows.map((d) => [d.rowNumber, {
      action: d.action, targetEntityId: d.targetEntityId,
    }]))
  }

  /** One existing record, described for the side-by-side comparison. */
  private describeCandidate(
    entityId: string,
    index: ProjectIndexForImport,
    entityType: ImportEntityType,
  ) {
    const existing = entityType === ImportEntityType.OWNER
      ? index.ownerById.get(entityId)
      : index.residentById.get(entityId)
    if (!existing) return { entityId, name: null, phone: null, email: null, isActive: null }
    return {
      entityId,
      name: 'fullName' in existing
        ? existing.fullName
        : `${existing.firstName} ${existing.lastName}`,
      phone: existing.phone,
      email: existing.email,
      isActive: existing.isActive,
    }
  }

  /** Replaces the job's issue rows with the current validation result. */
  private async persistIssues(jobId: string, rows: ValidatedRow[], counts: Counts) {
    const data = rows.flatMap((r) =>
      r.issues.map((i) => ({
        jobId,
        rowNumber: r.rowNumber,
        outcome: r.outcome,
        severity: i.severity,
        field: i.field ?? null,
        column: i.column ?? null,
        code: i.code,
        message: i.message.slice(0, 500),
        // Already masked upstream where the field is PII.
        currentValue: i.currentValue?.slice(0, 200) ?? null,
        suggestion: i.suggestion?.slice(0, 300) ?? null,
        matchedEntityId: i.matchedEntityId ?? null,
        matchReason: i.matchReason ?? null,
      })),
    )

    const summary = new Map<string, { code: string; message: string; count: number }>()
    for (const r of rows) {
      for (const i of r.issues) {
        const e = summary.get(i.code)
        if (e) e.count++
        else summary.set(i.code, { code: i.code, message: i.message, count: 1 })
      }
    }

    await this.prisma.$transaction([
      this.prisma.importRowIssue.deleteMany({ where: { jobId } }),
      ...(data.length ? [this.prisma.importRowIssue.createMany({ data })] : []),
      this.prisma.importJob.update({
        where: { id: jobId },
        data: {
          errorSummary: [...summary.values()].sort((a, b) => b.count - a.count) as unknown as Prisma.InputJsonValue,
          failedRows: counts.invalid,
          skippedRows: counts.skipped + counts.needsReview,
        },
      }),
    ])
  }

  private async finish(
    jobId: string,
    status: ImportJobStatus,
    counts: Counts & { created?: number; updated?: number },
    startedAt: Date,
  ) {
    return this.prisma.importJob.update({
      where: { id: jobId },
      data: {
        status,
        createdRows: counts.created ?? 0,
        updatedRows: counts.updated ?? 0,
        skippedRows: counts.skipped + counts.needsReview,
        failedRows: counts.invalid,
        finishedAt: new Date(),
        durationMs: Date.now() - startedAt.getTime(),
      },
      select: JOB_PUBLIC_SELECT,
    })
  }

  private describeMapping(
    suggestions: ReturnType<typeof suggestMapping>,
    entityType: ImportEntityType,
  ) {
    const defs = fieldsFor(entityType)
    return suggestions.map((s) => {
      if (s.field == null) {
        return {
          index: s.index, column: s.column, field: null, label: null,
          confidence: 0, alternatives: [], needsConfirmation: false,
        }
      }
      const conf = (s as any).confidence as number
      const alts = ((s as any).alternatives as ImportFieldKey[]) ?? []
      return {
        index: s.index,
        column: s.column,
        field: s.field,
        label: defs.find((d) => d.key === s.field)?.label ?? s.field,
        confidence: conf,
        alternatives: alts.map((a) => ({
          field: a, label: defs.find((d) => d.key === a)?.label ?? a,
        })),
        /**
         * The UI must make the user act on this before the job can proceed.
         * Anything short of an unambiguous exact alias hit qualifies.
         */
        needsConfirmation: conf < AMBIGUOUS_BELOW || alts.length > 0,
      }
    })
  }

  /**
   * A handful of rows for the mapping screen.
   *
   * Any column mapped to a sensitive field is masked here — the sample is the
   * one place a raw sheet value would otherwise be echoed straight back to the
   * browser, and a national ID column is exactly what a user maps first.
   */
  private sampleRows(
    sheet: ParsedSheet,
    entityType: ImportEntityType,
    suggestions: ReturnType<typeof suggestMapping>,
  ) {
    const sensitiveIndexes = new Set(
      suggestions
        .filter((s) => s.field != null && isSensitiveField(s.field))
        .map((s) => s.index),
    )
    void entityType
    return sheet.rows.slice(0, 5).map((r) => ({
      rowNumber: r.rowNumber,
      values: sheet.headers.map((_, i) =>
        sensitiveIndexes.has(i) ? maskCell(r.values[i] ?? '') : (r.values[i] ?? ''),
      ),
    }))
  }

  /** One preview row, shaped for the UI. Contains no unmasked PII. */
  private describeRow(
    r: ValidatedRow,
    index: ProjectIndexForImport,
    entityType: ImportEntityType,
  ) {
    const existing = r.match
      ? entityType === ImportEntityType.OWNER
        ? index.ownerById.get(r.match.entityId)
        : index.residentById.get(r.match.entityId)
      : undefined

    return {
      rowNumber: r.rowNumber,
      outcome: r.outcome,
      apartmentId: r.apartmentId ?? null,
      apartmentLabel: r.apartmentId ? index.apartmentLabels.get(r.apartmentId) ?? null : null,
      imported: {
        name: entityType === ImportEntityType.OWNER
          ? r.values.fullName ?? ''
          : `${r.values.firstName ?? ''} ${r.values.lastName ?? ''}`.trim(),
        phone: r.values.phone ?? null,
        email: r.values.email ?? null,
        // Presence only — the value never leaves the server.
        hasNationalId: Boolean(r.values.nationalId),
        share: r.values.share
          ? `${r.values.share.shareNumerator}/${r.values.share.shareDenominator}`
          : null,
      },
      match: r.match
        ? {
            entityId: r.match.entityId,
            reason: r.match.reason,
            ambiguous: r.match.ambiguous,
            candidateCount: r.match.candidateIds.length,
            existing: existing
              ? {
                  name: 'fullName' in existing
                    ? existing.fullName
                    : `${existing.firstName} ${existing.lastName}`,
                  phone: existing.phone,
                  email: existing.email,
                }
              : null,
            recommendedAction: recommendedAction(r.outcome, r.match.ambiguous),
          }
        : null,
      issues: r.issues.map((i) => ({
        severity: i.severity, field: i.field ?? null, column: i.column ?? null,
        code: i.code, message: i.message,
        currentValue: i.currentValue ?? null, suggestion: i.suggestion ?? null,
      })),
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const JOB_PUBLIC_SELECT = {
  id: true, projectId: true, entityType: true, mode: true, status: true,
  fileName: true, fileSize: true, sheetName: true, sheetHeaders: true,
  columnMapping: true, totalRows: true, createdRows: true, updatedRows: true,
  skippedRows: true, failedRows: true, errorSummary: true, failureReason: true,
  startedAt: true, finishedAt: true, durationMs: true,
  createdById: true, createdAt: true, updatedAt: true,
  // storageKey deliberately omitted — the object key is a capability and must
  // never leave the server, exactly as with Document.s3Key.
} as const

/** One `OwnershipService` issue, projected onto a sheet row. */
interface OwnershipRowIssue {
  severity: 'ERROR' | 'WARNING'
  code: string
  message: string
}

export interface Counts {
  total: number
  create: number
  update: number
  skipped: number
  needsReview: number
  invalid: number
  warnings: number
}

function tally(rows: ValidatedRow[]): Counts {
  const c: Counts = { total: rows.length, create: 0, update: 0, skipped: 0, needsReview: 0, invalid: 0, warnings: 0 }
  for (const r of rows) {
    switch (r.outcome) {
      case ImportRowOutcome.CREATE: c.create++; break
      case ImportRowOutcome.UPDATE: c.update++; break
      case ImportRowOutcome.SKIP_DUPLICATE:
      case ImportRowOutcome.SKIP_MODE: c.skipped++; break
      case ImportRowOutcome.NEEDS_REVIEW: c.needsReview++; break
      default: c.invalid++
    }
    if (r.issues.some((i) => i.severity === ImportIssueSeverity.WARNING)) c.warnings++
  }
  return c
}

function recommendedAction(outcome: ImportRowOutcome, ambiguous: boolean): string {
  if (ambiguous) return 'REVIEW'
  switch (outcome) {
    case ImportRowOutcome.CREATE: return 'CREATE'
    case ImportRowOutcome.UPDATE: return 'UPDATE'
    case ImportRowOutcome.SKIP_DUPLICATE:
    case ImportRowOutcome.SKIP_MODE: return 'SKIP'
    default: return 'REVIEW'
  }
}

function maskCell(v: string): string {
  const digits = v.replace(/\D/g, '')
  return digits.length ? `••••••••• (${digits.length} ספרות)` : (v ? '•••' : '')
}

/** RFC 4180 quoting. A leading `=`/`+`/`-`/`@` is neutralised — see below. */
function csvCell(v: string): string {
  // CSV INJECTION. Excel treats a cell starting with = + - @ as a formula, and
  // this report is built from user-supplied sheet content and opened in Excel
  // by definition. Prefixing a tab makes the cell inert text without changing
  // what the reader sees.
  const safe = /^[=+\-@\t\r]/.test(v) ? `\t${v}` : v
  return `"${safe.replace(/"/g, '""')}"`
}

function statusHe(s: ImportJobStatus): string {
  const map: Record<ImportJobStatus, string> = {
    UPLOADED: 'הועלה', MAPPED: 'מופה', PREVIEWED: 'בתצוגה מקדימה',
    IMPORTING: 'בייבוא', COMPLETED: 'הושלם', FAILED: 'נכשל', CANCELLED: 'בוטל',
  }
  return map[s] ?? s
}

function outcomeHe(o: ImportRowOutcome): string {
  const map: Record<ImportRowOutcome, string> = {
    CREATE: 'יצירה', UPDATE: 'עדכון', SKIP_DUPLICATE: 'דילוג — כפילות',
    SKIP_MODE: 'דילוג — מצב ייבוא', INVALID: 'שגיאה', NEEDS_REVIEW: 'דורש בדיקה',
  }
  return map[o] ?? o
}

/** Structural type for a multer file — mirrors the documents controller. */
export interface UploadedFileLike {
  originalname: string
  mimetype: string
  size: number
  buffer: Buffer
}
