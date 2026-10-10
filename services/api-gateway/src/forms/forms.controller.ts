import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Request } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import { Roles } from '../auth/decorators/roles.decorator'
import { STAFF_ROLES } from '../auth/roles.constants'
import { FormsService } from './forms.service'
import { CreateFormDto, PaperSignatureDto, UpdateFormDto } from './dto/forms.dto'

/** The roles that may create, send and sign for forms: those of signature packages. */
const FORM_MANAGERS = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER', 'LAWYER'] as const

/**
 * Digital forms, for staff: the representation-appointment protocol made for
 * a complex, filled in, sent to its owners and tracked to the last
 * signature. Every staff role can see a form's progress; creating, sending,
 * reminding, recording a paper signature and the combined document (every
 * owner's ID number) are for the roles that manage signature packages.
 */
@ApiTags('forms')
@ApiBearerAuth()
@Roles(...STAFF_ROLES)
@Controller({ path: 'forms', version: '1' })
export class FormsController {
  constructor(private readonly forms: FormsService) {}

  @Get('scopes')
  @ApiOperation({ summary: 'Projects and their complexes, for choosing where a form goes' })
  scopes(@Request() req: any) {
    return this.forms.scopes(req.user.tenantId)
  }

  @Get()
  @ApiOperation({ summary: 'Forms, newest first, with signing progress' })
  @ApiQuery({ name: 'projectId', required: false })
  list(@Request() req: any, @Query('projectId') projectId?: string) {
    return this.forms.list(req.user.tenantId, projectId)
  }

  @Post()
  @Roles(...FORM_MANAGERS)
  @ApiOperation({ summary: 'Create a draft form for a complex' })
  create(@Body() dto: CreateFormDto, @Request() req: any) {
    return this.forms.create(dto, req.user.userId, req.user.tenantId)
  }

  @Get(':id')
  @ApiOperation({ summary: 'A form: details, members, every owner row and progress' })
  get(@Param('id') id: string, @Request() req: any) {
    return this.forms.get(id, req.user.tenantId)
  }

  @Patch(':id')
  @Roles(...FORM_MANAGERS)
  @ApiOperation({ summary: 'Edit a draft: meeting details and representation members' })
  update(@Param('id') id: string, @Body() dto: UpdateFormDto, @Request() req: any) {
    return this.forms.update(id, dto, req.user.tenantId)
  }

  @Post(':id/send')
  @Roles(...FORM_MANAGERS)
  @ApiOperation({ summary: 'Send the form: each owner gets a personal link by SMS or email' })
  send(@Param('id') id: string, @Request() req: any) {
    return this.forms.send(id, req.user.userId, req.user.tenantId)
  }

  @Get(':id/document')
  @Roles(...FORM_MANAGERS)
  @ApiOperation({ summary: 'The combined document, every signed row included' })
  document(@Param('id') id: string, @Request() req: any) {
    return this.forms.document(id, req.user.tenantId)
  }

  @Post(':id/remind')
  @Roles(...FORM_MANAGERS)
  @ApiOperation({ summary: 'Remind every owner who has not signed (at most once a day each)' })
  remindAll(@Param('id') id: string, @Request() req: any) {
    return this.forms.remindAll(id, req.user.tenantId)
  }

  @Post(':id/records/:recordId/remind')
  @Roles(...FORM_MANAGERS)
  @ApiOperation({ summary: 'Remind one owner' })
  remind(@Param('id') id: string, @Param('recordId') recordId: string, @Request() req: any) {
    return this.forms.remind(id, recordId, req.user.tenantId)
  }

  @Post(':id/records/:recordId/paper')
  @Roles(...FORM_MANAGERS)
  @ApiOperation({ summary: 'Record a signature made on the printed form, with the scanned page' })
  paper(
    @Param('id') id: string,
    @Param('recordId') recordId: string,
    @Body() dto: PaperSignatureDto,
    @Request() req: any,
  ) {
    return this.forms.markSignedOnPaper(id, recordId, dto, req.user.userId, req.user.tenantId)
  }

  @Delete(':id')
  @Roles(...FORM_MANAGERS)
  @ApiOperation({ summary: 'Cancel a form; its links stop working' })
  cancel(@Param('id') id: string, @Request() req: any) {
    return this.forms.cancel(id, req.user.userId, req.user.tenantId)
  }
}
