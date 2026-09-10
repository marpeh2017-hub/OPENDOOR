import {
  Controller, Get, Post, Delete,
  Param, Body, Request, Query, UnauthorizedException, NotFoundException,
  BadRequestException, PayloadTooLargeException,
  UploadedFile, UseInterceptors, UseFilters, HttpCode, HttpStatus,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import {
  ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiConsumes, ApiBody,
} from '@nestjs/swagger'
import { Roles } from '../auth/decorators/roles.decorator'
import { PrismaService } from '../prisma.service'
import { MalwareScanService } from './malware/malware-scan.service'
import { StorageService } from '../storage/storage.service'
import { STAFF_ROLES, MANAGER_ROLES, DOCUMENT_WRITE_ROLES, RESIDENT_SHARE_ROLES } from '../auth/roles.constants'
import { DocumentCategory } from '@prisma/client'
import { CreateDocumentDto } from './dto/create-document.dto'
import { UploadDocumentDto } from './dto/upload-document.dto'
import { MulterExceptionFilter } from '../filters/multer-exception.filter'
import { UploadDocumentVersionDto } from './dto/upload-version.dto'
import { ShareDocumentDto } from './dto/share-document.dto'
import { AuditService } from '../common/audit/audit.service'
import { actorFrom } from '../common/actor'
import {
  ALLOWED_DOCUMENT_MIME_TYPES, MAX_DOCUMENT_BYTES, UPLOAD_ERRORS,
  sanitizeFileName, validateFileSignature,
} from './document-upload.constants'

/**
 * Minimal structural type for a multer file. Declared locally instead of using
 * `Express.Multer.File` so the build does not depend on `@types/multer` being
 * installed alongside `@nestjs/platform-express`.
 */
interface UploadedFileLike {
  originalname: string
  mimetype:     string
  size:         number
  buffer:       Buffer
}

/**
 * Columns safe to return to any API caller.
 *
 * `s3Key` / `s3Bucket` are intentionally absent: the storage key is a
 * capability (it is all `getSignedUrl` needs) and must never leave the server.
 * Downloads go through GET /documents/:id/download instead.
 */
const PUBLIC_DOCUMENT_FIELDS = {
  id: true, title: true, description: true, category: true, status: true,
  fileName: true, fileSize: true, mimeType: true, projectId: true,
  version: true, parentId: true, isLatest: true,
  createdById: true, createdAt: true, updatedAt: true,
  // s3Key / s3Bucket intentionally omitted — use /download endpoint
} as const

/** Version rows carry the uploader, so the history says who and when. */
const VERSION_SELECT = {
  ...PUBLIC_DOCUMENT_FIELDS,
  createdBy: { select: { id: true, firstName: true, lastName: true } },
} as const

@ApiTags('documents')
@ApiBearerAuth()
@Controller({ path: 'documents', version: '1' })
export class DocumentsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly malware: MalwareScanService,
  ) {}

  private tenantId(req: any): string {
    if (!req.user?.tenantId) throw new UnauthorizedException('Missing tenant context')
    return req.user.tenantId
  }

  /**
   * NOTE: `JwtStrategy.validate` returns `userId` — NOT `sub`. Reading
   * `req.user.sub` here yields `undefined` and then fails the non-nullable
   * `Document.createdById` FK at the database.
   */
  private userId(req: any): string {
    const id = req.user?.userId
    if (!id) throw new UnauthorizedException('Missing user context')
    return id
  }

  /**
   * The complete upload policy, applied identically by /upload and
   * /:id/versions.
   *
   * Order matters: the cheap checks (present, non-empty, size) run before the
   * type checks, and every one of them runs BEFORE anything touches storage, so
   * a rejected request never leaves an orphan object in the bucket.
   *
   * `validateFileSignature` is the substantive addition — the allow-list used
   * to trust `file.mimetype`, which is a client-supplied header, so an
   * executable renamed to `.pdf` and posted as `application/pdf` passed. It now
   * has to also LOOK like a PDF in its leading bytes.
   */
  /**
   * ⚠ MEMORY — BUFFERING POINT 2 OF 2.
   *
   * `FileInterceptor` uses multer's memory storage, so `file.buffer` is the
   * WHOLE file resident in this process. The CRM's BFF proxy already buffered
   * the identical bytes on its way here (buffering point 1, `req.arrayBuffer()`
   * in `apps/crm/src/app/api/proxy/[...path]/route.ts`). At the 100 MB
   * MAX_DOCUMENT_BYTES raised for CAD, that is ~200 MB resident per in-flight
   * upload across the two processes, and concurrency is unbounded. A presigned
   * direct-to-S3 upload that bypasses both hops is the proper fix and is not
   * built yet.
   *
   * FORMAT validation only — size, MIME allow-list, real byte signature and a
   * structural probe. It proves the bytes ARE the declared format; it does not
   * prove they are safe.
   *
   * CONTENT safety is a separate step: `MalwareScanService.assertClean` runs at
   * each upload site immediately before the bytes are stored. It is kept apart
   * from this method deliberately — this one is synchronous and cheap and
   * rejects obvious garbage before anything expensive happens, while scanning
   * is a network round trip to clamd that only makes sense once the file looks
   * like a real document.
   */
  private assertAcceptableFile(file: UploadedFileLike | undefined): asserts file is UploadedFileLike {
    if (!file)                          throw new BadRequestException(UPLOAD_ERRORS.missingFile)
    if (!file.size || file.size === 0)  throw new BadRequestException(UPLOAD_ERRORS.emptyFile)
    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException(UPLOAD_ERRORS.emptyFile)
    }
    if (file.size > MAX_DOCUMENT_BYTES) throw new PayloadTooLargeException(UPLOAD_ERRORS.tooLarge)
    if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(UPLOAD_ERRORS.badType)
    }

    const signature = validateFileSignature(file.mimetype, file.originalname ?? '', file.buffer)
    if (!signature.ok) {
      // The filename is NOT echoed back — it is attacker-controlled text that
      // would be rendered in the CRM.
      throw new BadRequestException(signature.message ?? UPLOAD_ERRORS.badType)
    }
  }

  /**
   * Resolves the ROOT of a version chain, inside the tenant.
   *
   * Accepts the id of ANY version so a client holding a link to version 1 can
   * still upload version 4 — the alternative (only the latest id works) would
   * make a stale browser tab silently start a second chain.
   */
  private async resolveChainRoot(id: string, tenantId: string) {
    const doc = await this.prisma.document.findFirst({
      where: { id, tenantId },
      select: {
        id: true, parentId: true, projectId: true, category: true,
        title: true, description: true, status: true,
      },
    })
    if (!doc) throw new NotFoundException('Document not found')
    if (!doc.parentId) return doc

    // Re-resolve INSIDE the tenant. A parentId is a stored value, and reading
    // it without the tenant filter would be the one unscoped lookup here.
    const root = await this.prisma.document.findFirst({
      where: { id: doc.parentId, tenantId },
      select: {
        id: true, parentId: true, projectId: true, category: true,
        title: true, description: true, status: true,
      },
    })
    if (!root) throw new NotFoundException('Document not found')
    return root
  }

  /**
   * Two-step tenant scoping: resolve the parent inside the caller's tenant, so
   * a projectId belonging to another tenant is a 404 rather than a
   * cross-tenant write.
   */
  private async assertProject(projectId: string, tenantId: string): Promise<void> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenantId },
      select: { id: true },
    })
    if (!project) throw new NotFoundException('Project not found')
  }

  @Get()
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'List documents' })
  @ApiQuery({ name: 'projectId', required: false })
  @ApiQuery({ name: 'category', required: false, enum: DocumentCategory })
  @ApiQuery({
    name: 'includeVersions', required: false,
    description: 'Include superseded versions. Default false — the library shows current documents only.',
  })
  findAll(
    @Request() req: any,
    @Query('projectId') projectId?: string,
    @Query('category') category?: DocumentCategory,
    @Query('includeVersions') includeVersions?: string,
  ) {
    const tenantId = this.tenantId(req)
    // Superseded versions are hidden by default: a corrected נסח טאבו should
    // appear ONCE in the library, not once per revision. The full chain is
    // available from GET /documents/:id/versions, and this flag is the escape
    // hatch for an audit view.
    const all = includeVersions === 'true'
    return this.prisma.document.findMany({
      where: {
        tenantId,
        ...(all ? {} : { isLatest: true }),
        ...(projectId ? { projectId } : {}),
        ...(category ? { category } : {}),
      },
      select: {
        id: true, title: true, category: true, status: true,
        fileSize: true, mimeType: true, projectId: true,
        createdAt: true, updatedAt: true,
        version: true, parentId: true, isLatest: true,
        // s3Key intentionally omitted — use /download endpoint
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  @Get(':id')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Get document metadata' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    const tenantId = this.tenantId(req)
    const doc = await this.prisma.document.findFirst({
      where: { id, tenantId },
      select: {
        id: true, title: true, category: true, status: true,
        fileSize: true, mimeType: true, projectId: true,
        createdAt: true, version: true, parentId: true, isLatest: true,
      },
    })
    if (!doc) throw new NotFoundException('Document not found')
    return doc
  }

  @Get(':id/download')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Get a signed download URL (15 min)' })
  async download(@Param('id') id: string, @Request() req: any) {
    const tenantId = this.tenantId(req)
    const doc = await this.prisma.document.findFirst({ where: { id, tenantId } })
    if (!doc) throw new NotFoundException('Document not found')
    // A metadata-only record (POST /documents) has no object behind it.
    if (!doc.s3Key) throw new NotFoundException('No file is attached to this document')
    const url = await this.storage.getSignedUrl(tenantId, doc.s3Key)
    return { url, expiresIn: 900 }
  }

  /**
   * Metadata-only record, kept for callers that register a document before the
   * file exists. It stores an EMPTY storage key — `/download` refuses such a
   * record rather than minting a URL to nothing. To attach a real file use
   * POST /documents/upload.
   *
   * Rewritten from `data: { ...body, tenantId }`, which was (a) a
   * mass-assignment hole letting a client set `s3Key`, `s3Bucket`, `isPublic`,
   * `version`, `parentId` and `ocrText` freely, and (b) missing the required
   * `createdById` FK, so every call failed at the database.
   */
  @Post()
  @Roles(...DOCUMENT_WRITE_ROLES)
  @ApiOperation({ summary: 'Create document record (metadata only, no file)' })
  async create(@Body() dto: CreateDocumentDto, @Request() req: any) {
    const tenantId = this.tenantId(req)
    const createdById = this.userId(req)

    if (dto.projectId) await this.assertProject(dto.projectId, tenantId)

    return this.prisma.document.create({
      data: {
        tenantId,
        createdById,
        title:       dto.title,
        category:    dto.category as DocumentCategory,
        ...(dto.status      ? { status: dto.status as any } : {}),
        ...(dto.description ? { description: dto.description } : {}),
        ...(dto.projectId   ? { projectId: dto.projectId } : {}),
        fileName:    dto.fileName,
        fileSize:    dto.fileSize,
        mimeType:    dto.mimeType,
        s3Key:       '', // no file attached yet — see /upload
        s3Bucket:    '',
      },
      select: PUBLIC_DOCUMENT_FIELDS,
    })
  }

  /**
   * Upload a file and create the matching Document row.
   *
   * This endpoint exists because nothing else could produce a usable document:
   * `Document.s3Key`/`s3Bucket` are non-nullable, no route exposed
   * `StorageService.upload`, and there was no multipart handling anywhere in
   * the service.
   *
   * Order of operations is deliberate — validate everything (RBAC, DTO, tenant
   * ownership of the parent project, MIME allow-list, size) BEFORE touching
   * storage, so a rejected request never leaves an orphan object in the bucket.
   * If the database write fails after the upload, the object is best-effort
   * deleted so the bucket does not accumulate unreferenced files.
   */
  @Post('upload')
  @Roles(...DOCUMENT_WRITE_ROLES)
  @HttpCode(HttpStatus.CREATED)
  @UseFilters(MulterExceptionFilter)
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: MAX_DOCUMENT_BYTES, files: 1 },
  }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a document file (multipart/form-data)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'title', 'category', 'projectId'],
      properties: {
        file:        { type: 'string', format: 'binary' },
        title:       { type: 'string' },
        category:    { type: 'string' },
        projectId:   { type: 'string' },
        status:      { type: 'string' },
        description: { type: 'string' },
      },
    },
  })
  async upload(
    @UploadedFile() file: UploadedFileLike | undefined,
    @Body() dto: UploadDocumentDto,
    @Request() req: any,
  ) {
    const tenantId    = this.tenantId(req)
    const createdById = this.userId(req)

    this.assertAcceptableFile(file)

    // Parent scoping — also the tenant-isolation boundary (cross-tenant → 404).
    await this.assertProject(dto.projectId, tenantId)

    const fileName = sanitizeFileName(file.originalname)

    // StorageService.upload always prefixes the key with `${tenantId}/`, which
    // is the same prefix `getSignedUrl`/`delete` verify before acting.
    // Scanned BEFORE the bytes reach storage. Scanning after upload would mean
    // an infected object exists in the bucket, reachable by presigned URL, for
    // as long as the cleanup takes.
    await this.malware.assertClean(file.buffer, file.originalname ?? fileName)

    const s3Key = await this.storage.upload(
      tenantId, 'documents', fileName, file.buffer, file.mimetype,
    )

    try {
      return await this.prisma.document.create({
        data: {
          tenantId,
          createdById,
          projectId:   dto.projectId,
          title:       dto.title,
          category:    dto.category as DocumentCategory,
          ...(dto.status      ? { status: dto.status as any } : {}),
          ...(dto.description ? { description: dto.description } : {}),
          fileName,
          fileSize:    file.size,
          mimeType:    file.mimetype,
          s3Key,
          s3Bucket:    process.env.S3_BUCKET ?? '',
        },
        select: PUBLIC_DOCUMENT_FIELDS,
      })
    } catch (err) {
      // Do not leave an orphan object behind. Never log the key.
      await this.storage.delete(tenantId, s3Key).catch(() => {})
      throw err
    }
  }

  // ── Version history ───────────────────────────────────────────────────────

  /**
   * The full version chain for a document, newest first.
   *
   * Accepts the id of any version. Each entry carries its own id, so an earlier
   * version is viewed or downloaded through the ordinary
   * GET /documents/:versionId/download — no special-case download route, and no
   * storage key leaves the server.
   */
  // ══════════════════════════════════════════════════════════════════════════
  //  Sharing a document with a resident
  // ══════════════════════════════════════════════════════════════════════════
  //
  // `ResidentDocument` has existed since the schema was written and nothing
  // ever wrote to it. The resident portal reads it as the answer to "which
  // documents may this resident see", so without a writer that page is empty
  // by construction — the table described a sharing decision the product had
  // no way to make.
  //
  // Sharing is an ACCESS GRANT, not a metadata edit: afterwards a person
  // outside the organisation can read that file. So it is audited like one, it
  // is restricted to the roles that may create documents in the first place,
  // and both sides of it are re-checked against the caller's tenant.

  /**
   * Who this document is shared with.
   *
   * Staff-facing, and worth being able to ask before sharing it with one more
   * person: it answers "who outside the company can already read this".
   */
  @Get(':id/residents')
  @Roles(...STAFF_ROLES)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Residents this document is shared with' })
  async sharedWith(@Param('id') id: string, @Request() req: any) {
    const tenantId = this.tenantId(req)
    await this.documentInTenant(id, tenantId)

    const rows = await this.prisma.residentDocument.findMany({
      where: { documentId: id },
      select: {
        addedAt: true,
        resident: {
          select: {
            id: true, firstName: true, lastName: true, isActive: true,
            apartment: { select: { apartmentNumber: true } },
          },
        },
      },
      orderBy: { addedAt: 'desc' },
    })

    return rows.map((r) => ({
      residentId: r.resident.id,
      name: `${r.resident.firstName} ${r.resident.lastName}`.trim(),
      apartmentNumber: r.resident.apartment.apartmentNumber,
      isActive: r.resident.isActive,
      sharedAt: r.addedAt,
    }))
  }

  @Post(':id/residents')
  @Roles(...RESIDENT_SHARE_ROLES)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Share a document with one resident' })
  async share(@Param('id') id: string, @Body() dto: ShareDocumentDto, @Request() req: any) {
    const tenantId = this.tenantId(req)
    const doc = await this.documentInTenant(id, tenantId)
    const resident = await this.residentInTenant(dto.residentId, tenantId)

    /*
     * Idempotent, via the unique (residentId, documentId) constraint. Sharing
     * twice is what a person does when they are not sure the first click
     * registered, and it should not be an error — but the original `addedAt`
     * is kept, because it is the date the grant actually began.
     */
    const existing = await this.prisma.residentDocument.findUnique({
      where: { residentId_documentId: { residentId: resident.id, documentId: id } },
      select: { addedAt: true },
    })
    if (existing) {
      return { documentId: id, residentId: resident.id, sharedAt: existing.addedAt, alreadyShared: true }
    }

    const row = await this.prisma.residentDocument.create({
      data: { residentId: resident.id, documentId: id },
      select: { addedAt: true },
    })

    await this.audit.record(actorFrom(req), {
      action: 'CREATE', entity: 'ResidentDocument', entityId: id,
      changes: { after: { residentId: resident.id, documentId: id } },
      metadata: {
        documentTitle: doc.title, projectId: doc.projectId,
        grant: 'DOCUMENT_SHARED_WITH_RESIDENT',
      },
    })

    return { documentId: id, residentId: resident.id, sharedAt: row.addedAt, alreadyShared: false }
  }

  /**
   * Withdraw the share.
   *
   * Deletes the join row only. Revoking one resident's access to a file is not
   * a reason to destroy the file.
   */
  @Delete(':id/residents/:residentId')
  @Roles(...RESIDENT_SHARE_ROLES)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Stop sharing a document with a resident' })
  async unshare(
    @Param('id') id: string,
    @Param('residentId') residentId: string,
    @Request() req: any,
  ) {
    const tenantId = this.tenantId(req)
    const doc = await this.documentInTenant(id, tenantId)
    await this.residentInTenant(residentId, tenantId, { allowArchived: true })

    const removed = await this.prisma.residentDocument.deleteMany({
      where: { documentId: id, residentId },
    })
    if (removed.count === 0) {
      throw new NotFoundException('This document is not shared with that resident')
    }

    await this.audit.record(actorFrom(req), {
      action: 'DELETE', entity: 'ResidentDocument', entityId: id,
      changes: { before: { residentId, documentId: id } },
      metadata: { documentTitle: doc.title, grant: 'DOCUMENT_SHARE_REVOKED' },
    })
  }

  /** A document in the caller's tenant, or 404. Never 403 — see TenantScopeService. */
  private async documentInTenant(id: string, tenantId: string) {
    const doc = await this.prisma.document.findFirst({
      where: { id, tenantId },
      select: { id: true, title: true, projectId: true },
    })
    if (!doc) throw new NotFoundException('Document not found')
    return doc
  }

  /**
   * A resident in the caller's tenant, or 404.
   *
   * Scoped through apartment → building → complex → project rather than through
   * `Resident.tenantId`. That column is a bare scalar with no foreign key and
   * can disagree with where the apartment actually sits; the traversal is the
   * authoritative answer, and granting access to a file is exactly the kind of
   * decision that should not rest on the weaker of two available checks.
   *
   * Archived residents cannot be GIVEN access — a former resident is not
   * someone to start sharing with — but access can always be TAKEN AWAY from
   * one, which is why revoking passes `allowArchived`.
   */
  private async residentInTenant(
    residentId: string,
    tenantId: string,
    opts: { allowArchived?: boolean } = {},
  ) {
    const resident = await this.prisma.resident.findFirst({
      where: {
        id: residentId,
        apartment: { building: { complex: { project: { tenantId } } } },
      },
      select: { id: true, isActive: true },
    })
    if (!resident) throw new NotFoundException('Resident not found')
    if (!resident.isActive && !opts.allowArchived) {
      throw new BadRequestException('Cannot share a document with an archived resident')
    }
    return resident
  }

  @Get(':id/versions')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Version history of a document, newest first' })
  async versions(@Param('id') id: string, @Request() req: any) {
    const tenantId = this.tenantId(req)
    const root = await this.resolveChainRoot(id, tenantId)

    const chain = await this.prisma.document.findMany({
      // Tenant-scoped again rather than trusting the chain: cheap, and it keeps
      // every read in this file uniformly scoped.
      where: { tenantId, OR: [{ id: root.id }, { parentId: root.id }] },
      select: VERSION_SELECT,
      orderBy: { version: 'desc' },
    })

    return {
      documentId: root.id,
      latestVersion: chain.find((c) => c.isLatest)?.version ?? chain[0]?.version ?? 1,
      count: chain.length,
      versions: chain,
    }
  }

  /**
   * Upload a replacement, creating a NEW version.
   *
   * GUARANTEES
   *   - the previous physical object is never overwritten or deleted: every
   *     version gets its own storage key, so an earlier נסח טאבו stays
   *     downloadable forever;
   *   - the new row is `isLatest`, and the transaction clears the flag on every
   *     other member of the chain, so exactly one row is current;
   *   - `projectId` and `category` are INHERITED from the root and cannot be
   *     supplied, so a version cannot relocate a document;
   *   - who uploaded it and when are on the row (`createdById`, `createdAt`)
   *     and in the audit log.
   *
   * The version number is computed inside the transaction from the chain's
   * current maximum, so two concurrent uploads cannot both claim version 3.
   */
  @Post(':id/versions')
  @Roles(...DOCUMENT_WRITE_ROLES)
  @HttpCode(HttpStatus.CREATED)
  @UseFilters(MulterExceptionFilter)
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: MAX_DOCUMENT_BYTES, files: 1 },
  }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a new version of an existing document' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file:        { type: 'string', format: 'binary' },
        title:       { type: 'string' },
        status:      { type: 'string' },
        description: { type: 'string' },
      },
    },
  })
  async uploadVersion(
    @Param('id') id: string,
    @UploadedFile() file: UploadedFileLike | undefined,
    @Body() dto: UploadDocumentVersionDto,
    @Request() req: any,
  ) {
    const actor = actorFrom(req)
    const tenantId = actor.tenantId

    this.assertAcceptableFile(file)
    // Tenant boundary: another tenant's document id is a 404 here, and the
    // file is never stored.
    const root = await this.resolveChainRoot(id, tenantId)

    const fileName = sanitizeFileName(file.originalname)

    // Its OWN key — `randomBytes` in StorageService.upload guarantees it does
    // not collide with the previous version's object even for the same filename.
    // Scanned BEFORE the bytes reach storage. Scanning after upload would mean
    // an infected object exists in the bucket, reachable by presigned URL, for
    // as long as the cleanup takes.
    await this.malware.assertClean(file.buffer, file.originalname ?? fileName)

    const s3Key = await this.storage.upload(
      tenantId, 'documents', fileName, file.buffer, file.mimetype,
    )

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const highest = await tx.document.findFirst({
          where: { tenantId, OR: [{ id: root.id }, { parentId: root.id }] },
          select: { version: true },
          orderBy: { version: 'desc' },
        })
        const nextVersion = (highest?.version ?? 0) + 1

        // Demote the whole chain first, then insert the new head — so there is
        // no instant in which two rows claim `isLatest`.
        await tx.document.updateMany({
          where: { tenantId, OR: [{ id: root.id }, { parentId: root.id }] },
          data: { isLatest: false },
        })

        return tx.document.create({
          data: {
            tenantId,
            createdById: actor.userId,
            parentId:    root.id,
            version:     nextVersion,
            isLatest:    true,
            // Inherited — a version cannot move or re-classify a document.
            projectId:   root.projectId,
            category:    root.category,
            title:       dto.title ?? root.title,
            description: dto.description ?? root.description,
            status:      (dto.status as any) ?? root.status,
            fileName,
            fileSize:    file.size,
            mimeType:    file.mimetype,
            s3Key,
            s3Bucket:    process.env.S3_BUCKET ?? '',
          },
          select: PUBLIC_DOCUMENT_FIELDS,
        })
      })

      await this.audit.record(actor, {
        action: 'CREATE', entity: 'Document', entityId: created.id,
        // No storage key — AuditService redacts `storagekey` anyway, but it is
        // not passed in the first place.
        changes: { after: { version: created.version, fileName, fileSize: file.size } },
        metadata: { rootDocumentId: root.id, projectId: root.projectId },
      })

      return created
    } catch (err) {
      // Do not leave an orphan object behind. Never log the key.
      await this.storage.delete(tenantId, s3Key).catch(() => {})
      throw err
    }
  }

  /**
   * Delete a document, or roll back the latest version.
   *
   * HISTORY IS PRESERVED. Deleting a SUPERSEDED version is refused outright —
   * that is the whole point of keeping the chain. Deleting the LATEST version
   * of a multi-version document removes only that version and promotes the one
   * before it, which is the undo for a mistaken re-upload. A single-version
   * document behaves exactly as it always did.
   *
   * Only the deleted version's own object is removed; every other version's
   * bytes are untouched.
   */
  @Delete(':id')
  @Roles(...MANAGER_ROLES)
  @ApiOperation({ summary: 'Delete a document, or roll back its latest version (manager+)' })
  async remove(@Param('id') id: string, @Request() req: any) {
    const actor = actorFrom(req)
    const tenantId = actor.tenantId

    const doc = await this.prisma.document.findFirst({ where: { id, tenantId } })
    if (!doc) throw new NotFoundException('Document not found')

    const rootId = doc.parentId ?? doc.id
    const chain = await this.prisma.document.findMany({
      where: { tenantId, OR: [{ id: rootId }, { parentId: rootId }] },
      select: { id: true, version: true, s3Key: true },
      orderBy: { version: 'desc' },
    })

    if (chain.length > 1 && !doc.isLatest) {
      throw new BadRequestException(
        'לא ניתן למחוק גרסה קודמת של מסמך — היסטוריית הגרסאות נשמרת. ניתן למחוק רק את הגרסה הנוכחית',
      )
    }

    // Rolling back a version: promote the previous one.
    if (chain.length > 1) {
      const previous = chain.find((c) => c.id !== doc.id)!
      await this.prisma.$transaction(async (tx) => {
        await tx.document.delete({ where: { id: doc.id } })
        await tx.document.update({ where: { id: previous.id }, data: { isLatest: true } })
      })
      if (doc.s3Key) {
        // Only THIS version's object. The promoted version keeps its own.
        await this.storage.delete(tenantId, doc.s3Key).catch(() => {})
      }
      await this.audit.record(actor, {
        action: 'DELETE', entity: 'Document', entityId: doc.id,
        changes: { before: { version: doc.version } },
        metadata: { rootDocumentId: rootId, promotedVersionId: previous.id, rolledBack: true },
      })
      return { id: doc.id, deleted: true, promotedToLatest: previous.id }
    }

    if (doc.s3Key) {
      await this.storage.delete(tenantId, doc.s3Key).catch(() => {}) // best-effort
    }
    const deleted = await this.prisma.document.delete({ where: { id } })
    await this.audit.record(actor, {
      action: 'DELETE', entity: 'Document', entityId: doc.id,
      changes: { before: { version: doc.version, title: doc.title } },
      metadata: { projectId: doc.projectId },
    })
    return deleted
  }
}
