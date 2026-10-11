import { Body, Controller, Get, Param, Patch, Request } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../auth/decorators/roles.decorator'
import { STAFF_ROLES } from '../auth/roles.constants'
import { PublicFormsService } from './public-forms.service'
import { PublicFormStatusDto } from './dto/public-forms.dto'

const FORM_MANAGERS = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER', 'LAWYER'] as const

/**
 * Protocols started on the website, for staff: the list for every staff
 * role, the document itself (every signer's ID number) and closing the
 * neighbours' link for the roles that manage signatures.
 */
@ApiTags('forms')
@ApiBearerAuth()
@Roles(...STAFF_ROLES)
@Controller({ path: 'website-forms', version: '1' })
export class WebsiteFormsController {
  constructor(private readonly forms: PublicFormsService) {}

  @Get()
  @ApiOperation({ summary: 'Protocols started on the website, newest first' })
  list(@Request() req: any) {
    return this.forms.list(req.user.tenantId)
  }

  @Get(':id')
  @Roles(...FORM_MANAGERS)
  @ApiOperation({ summary: 'One website protocol, every row included' })
  get(@Param('id') id: string, @Request() req: any) {
    return this.forms.get(id, req.user.tenantId)
  }

  @Patch(':id')
  @Roles(...FORM_MANAGERS)
  @ApiOperation({ summary: 'Close or reopen the neighbours’ link' })
  setStatus(@Param('id') id: string, @Body() dto: PublicFormStatusDto, @Request() req: any) {
    return this.forms.setStatus(id, dto.status, req.user.userId, req.user.tenantId)
  }
}
