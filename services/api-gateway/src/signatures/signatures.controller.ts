import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Request, Query, Ip, Headers, UnauthorizedException,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger'
import { Roles } from '../auth/decorators/roles.decorator'
import { STAFF_ROLES } from '../auth/roles.constants'
import { Public } from '../auth/decorators/public.decorator'
import { ThresholdService }          from './threshold.service'
import { SignaturePackageService }   from './signature-package.service'
import { SigningSessionService }     from './signing-session.service'
import { PortalSessionProbe } from '../auth/portal-session-probe.service'
import { SignatureExpiryService }    from './signature-expiry.service'
import { EvidencePackageService }    from './evidence-package.service'
import { StorageService }            from '../storage/storage.service'
import { CreatePackageDto }          from './dto/create-package.dto'

@ApiTags('signatures')
@ApiBearerAuth()
// Baseline authorization floor: every endpoint in this controller requires a
// staff role unless a method-level @Roles() narrows it further. @Public()
// routes bypass RolesGuard entirely.
@Roles(...STAFF_ROLES)
@Controller({ path: 'signatures', version: '1' })
export class SignaturesController {
  constructor(
    private readonly threshold: ThresholdService,
    private readonly packages: SignaturePackageService,
    private readonly sessions: SigningSessionService,
    private readonly portalSessions: PortalSessionProbe,
    private readonly expiry: SignatureExpiryService,
    private readonly evidence: EvidencePackageService,
    private readonly storage: StorageService,
  ) {}

  /* ─── Threshold ──────────────────────────────────────────────── */

  @Get('threshold/:projectId')
  @Roles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER')
  @ApiOperation({ summary: 'Live signature-threshold status (shares-based)' })
  getThreshold(@Param('projectId') projectId: string, @Request() req: any) {
    if (!req.user?.tenantId) throw new UnauthorizedException('Missing tenant context')
    return this.threshold.computeForProject(projectId, req.user.tenantId)
  }

  /* ─── Package CRUD ───────────────────────────────────────────── */

  @Post('packages')
  @Roles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER', 'LAWYER')
  @ApiOperation({ summary: 'Create a new signature package' })
  create(@Body() dto: CreatePackageDto, @Request() req: any) {
    return this.packages.create(dto, req.user.userId, req.user.tenantId)
  }

  @Get('packages')
  @ApiOperation({ summary: 'List signature packages' })
  @ApiQuery({ name: 'projectId', required: false })
  async findAll(@Request() req: any, @Query('projectId') projectId?: string) {
    // Expire overdue packages on each list call (lightweight)
    await this.expiry.expireOverduePackages(req.user.tenantId)
    return this.packages.findAll(req.user.tenantId, projectId)
  }

  @Get('packages/:id')
  @ApiOperation({ summary: 'Get package with records + event log' })
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.packages.findOne(id, req.user.tenantId)
  }

  @Get('packages/:id/progress')
  @ApiOperation({ summary: 'Signing progress summary' })
  getProgress(@Param('id') id: string, @Request() req: any) {
    return this.packages.getSigningProgress(id, req.user.tenantId)
  }

  /* ─── Signer management ──────────────────────────────────────── */

  @Post('packages/:id/signers')
  @Roles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER', 'LAWYER')
  @ApiOperation({ summary: 'Add a signer to a DRAFT package' })
  addSigner(
    @Param('id') id: string,
    @Body() body: { ownerId: string; apartmentId: string; signerRole?: string; required?: boolean; signingOrder?: number },
    @Request() req: any,
  ) {
    return this.packages.addSigner(id, body, req.user.tenantId)
  }

  @Delete('packages/:id/signers/:recordId')
  @Roles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER', 'LAWYER')
  @ApiOperation({ summary: 'Remove a signer from a DRAFT package' })
  removeSigner(
    @Param('id') id: string,
    @Param('recordId') recordId: string,
    @Request() req: any,
  ) {
    return this.packages.removeSigner(id, recordId, req.user.tenantId)
  }

  /* ─── Package lifecycle ──────────────────────────────────────── */

  @Patch('packages/:id/submit')
  @Roles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER', 'LAWYER')
  @ApiOperation({ summary: 'Submit package for internal review' })
  submit(@Param('id') id: string, @Request() req: any) {
    return this.packages.submitForReview(id, req.user.userId, req.user.tenantId)
  }

  @Patch('packages/:id/approve')
  @Roles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER', 'LAWYER')
  @ApiOperation({ summary: 'Approve package (manager/admin)' })
  approve(@Param('id') id: string, @Request() req: any) {
    return this.packages.approve(id, req.user.userId, req.user.tenantId)
  }

  @Patch('packages/:id/send')
  @Roles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER', 'LAWYER')
  @ApiOperation({ summary: 'Send package to signers' })
  send(@Param('id') id: string, @Request() req: any) {
    return this.packages.send(id, req.user.userId, req.user.tenantId)
  }

  @Delete('packages/:id')
  @Roles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER', 'LAWYER')
  @ApiOperation({ summary: 'Cancel a package' })
  cancel(@Param('id') id: string, @Request() req: any) {
    return this.packages.cancel(id, req.user.userId, req.user.tenantId)
  }

  @Get('packages/:id/events')
  @ApiOperation({ summary: 'Get full event log for a package' })
  events(@Param('id') id: string, @Request() req: any) {
    return this.packages.getEvents(id, req.user.tenantId)
  }

  /* ─── Reminders ──────────────────────────────────────────────── */

  @Post('packages/:id/remind/:recordId')
  @Roles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER', 'LAWYER')
  @ApiOperation({ summary: 'Send reminder to one signer' })
  remind(
    @Param('id') id: string,
    @Param('recordId') recordId: string,
    @Request() req: any,
  ) {
    return this.sessions.sendReminder(recordId, req.user.tenantId)
  }

  @Post('packages/:id/reissue/:recordId')
  @Roles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER', 'LAWYER')
  @ApiOperation({ summary: 'Reissue signing session token for one signer' })
  reissue(
    @Param('id') id: string,
    @Param('recordId') recordId: string,
    @Request() req: any,
  ) {
    return this.packages.reissueSession(id, recordId, req.user.tenantId)
  }

  /* ─── Evidence & download ────────────────────────────────────── */

  @Get('packages/:id/evidence')
  @ApiOperation({ summary: 'Get compiled evidence package' })
  async getEvidence(@Param('id') id: string, @Request() req: any) {
    return this.packages.getEvidence(id, req.user.tenantId)
  }

  @Get('packages/:id/evidence/pdf')
  @ApiOperation({ summary: 'Get signed URL (or base64) for evidence PDF' })
  async getEvidencePdf(@Param('id') id: string, @Request() req: any) {
    return this.evidence.downloadEvidencePdf(id, req.user.tenantId)
  }

  @Post('packages/:id/evidence/generate')
  @Roles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER', 'LAWYER')
  @ApiOperation({ summary: 'Manually trigger evidence package generation' })
  generateEvidence(@Param('id') id: string, @Request() req: any) {
    return this.packages.generateEvidencePackage(id, req.user.tenantId)
  }

  @Get('packages/:id/download')
  @ApiOperation({ summary: 'Get signed download URL for the package document' })
  async download(@Param('id') id: string, @Request() req: any) {
    // Deliberate internal lookup — the key is never part of a normal response.
    const key = await this.packages.getEvidencePackageKey(id, req.user.tenantId)
    if (!key) {
      return { message: 'ראיות החתימה טרם נוצרו או לא הועלו ל-S3' }
    }
    const url = await this.storage.getSignedUrl(req.user.tenantId, key, 900)
    return { url, expiresIn: 900 }
  }

  /* ─── Signing portal (public — token-authenticated) ─────────── */

  @Public()
  @Get('portal/:token')
  @ApiOperation({ summary: 'Owner opens signing link' })
  openPortal(
    @Param('token') token: string,
    @Ip() ip: string,
    @Headers('user-agent') ua: string,
  ) {
    return this.sessions.openSession(token, ip, ua)
  }

  @Public()
  @Post('portal/:token/otp')
  @ApiOperation({ summary: 'Request OTP code (sent to owner phone)' })
  requestOtp(@Param('token') token: string, @Ip() ip: string) {
    return this.sessions.requestOtp(token, ip)
  }

  @Public()
  @Post('portal/:token/verify')
  @ApiOperation({ summary: 'Verify OTP code' })
  verifyOtp(
    @Param('token') token: string,
    @Body('code') code: string,
    @Ip() ip: string,
    @Headers('user-agent') ua: string,
  ) {
    return this.sessions.verifyOtp(token, code, ip, ua)
  }

  /**
   * Execute signing after OTP verification.
   *
   * Still `@Public()`, and still driven entirely by the token: a resident who
   * clicks the link in their SMS signs exactly as they did before.
   *
   * The `Authorization` header is read OPTIONALLY. If the same person happens
   * to be signed in to the portal, the session is resolved and recorded on the
   * evidence event alongside the owner — including whether the authenticated
   * resident is in fact the one linked to that owner. `probe` never throws, so
   * a missing, malformed or expired header changes nothing at all.
   */
  @Public()
  @Post('portal/:token/sign')
  @ApiOperation({ summary: 'Execute signing after OTP verification' })
  async sign(
    @Param('token') token: string,
    @Ip() ip: string,
    @Headers('user-agent') ua: string,
    @Headers('authorization') authorization?: string,
  ) {
    const portalSession = await this.portalSessions.probe(authorization)
    return this.sessions.sign(token, ip, ua, portalSession)
  }

  @Public()
  @Post('portal/:token/decline')
  @ApiOperation({ summary: 'Decline signing with reason' })
  decline(
    @Param('token') token: string,
    @Body('reason') reason: string,
    @Ip() ip: string,
  ) {
    return this.sessions.decline(token, reason, ip)
  }
}
