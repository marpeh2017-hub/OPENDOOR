import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, Request, HttpCode,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger'
import { Roles } from '../auth/decorators/roles.decorator'
import { STAFF_ROLES, ADMIN_ROLES, TEMPLATE_WRITE_ROLES } from '../auth/roles.constants'
import { actorFrom, tenantFrom } from '../common/actor'
import { TemplatesService } from './templates.service'
import {
  CreateTemplateDto, UpdateTemplateDto, PreviewTemplateDto, SetApprovalDto,
} from './dto/template.dto'

/**
 * Communication template library.
 *
 * RBAC IS SPLIT THREE WAYS, and the split is about blast radius:
 *
 *   READ (`STAFF_ROLES`) — anyone who can send a message needs to see what the
 *   approved wording is, including the read-only observer roles.
 *
 *   WRITE (`TEMPLATE_WRITE_ROLES`) — a template is the text that goes to EVERY
 *   resident in a project at once. Authoring it is narrower than sending one
 *   message, which is why FIELD_AGENT is not on the list even though a field
 *   agent may send.
 *
 *   APPROVAL (`ADMIN_ROLES`) — `isApproved` asserts that WhatsApp reviewed this
 *   wording. It is deliberately unreachable through the general PATCH, the same
 *   way `cancelledAt` is reachable only through the meetings cancel route.
 */
@ApiTags('communications')
@ApiBearerAuth()
@Controller({ path: 'communication-templates', version: '1' })
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  @Get()
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'List templates for the tenant' })
  @ApiQuery({ name: 'channel',  required: false })
  @ApiQuery({ name: 'language', required: false })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  findAll(
    @Request() req: any,
    @Query('channel')  channel?: string,
    @Query('language') language?: string,
    /**
     * Parsed by hand rather than through `enableImplicitConversion`, which
     * coerces the STRING 'false' to boolean true and has already inverted a
     * query filter in this codebase once.
     */
    @Query('isActive') isActive?: string,
  ) {
    return this.templates.findAll(tenantFrom(req), {
      channel,
      language,
      isActive:
        isActive === undefined ? undefined
        : isActive === 'true'  ? true
        : isActive === 'false' ? false
        : undefined,
    })
  }

  @Get(':id')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'One template (404 across tenants)' })
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.templates.findOne(tenantFrom(req), id)
  }

  @Post()
  @Roles(...TEMPLATE_WRITE_ROLES)
  @ApiOperation({ summary: 'Create a template' })
  create(@Request() req: any, @Body() dto: CreateTemplateDto) {
    return this.templates.create(actorFrom(req), dto)
  }

  @Patch(':id')
  @Roles(...TEMPLATE_WRITE_ROLES)
  @ApiOperation({ summary: 'Update a template (channel and language are immutable)' })
  update(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    return this.templates.update(actorFrom(req), id, dto)
  }

  @Patch(':id/approval')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Record the WhatsApp provider approval state' })
  setApproval(@Request() req: any, @Param('id') id: string, @Body() dto: SetApprovalDto) {
    return this.templates.setApproval(actorFrom(req), id, dto.isApproved)
  }

  @Post(':id/preview')
  // POST because the values are a body, not because anything is created.
  // Nest would otherwise answer 201 for a pure render.
  @HttpCode(200)
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Render the template with supplied values' })
  preview(@Request() req: any, @Param('id') id: string, @Body() dto: PreviewTemplateDto) {
    return this.templates.preview(tenantFrom(req), id, dto.values)
  }

  @Delete(':id')
  @Roles(...TEMPLATE_WRITE_ROLES)
  @ApiOperation({ summary: 'Delete an unused template (409 once it has sent messages)' })
  remove(@Request() req: any, @Param('id') id: string) {
    return this.templates.remove(actorFrom(req), id)
  }
}
