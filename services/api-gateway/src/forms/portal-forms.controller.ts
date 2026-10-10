import { Controller, Get, Param } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../auth/decorators/roles.decorator'
import { CurrentUser, type CurrentUserPayload } from '../auth/decorators/current-user.decorator'
import { PortalScopeService } from '../portal/portal-scope.service'
import { PortalFormsService } from './portal-forms.service'

/**
 * A resident's forms. Like every portal route, the scope comes from the
 * session (PortalScopeService); the one parameter, a package id, is looked
 * up within that scope, so somebody else's form is simply not found.
 */
@ApiTags('portal')
@ApiBearerAuth()
@Roles('RESIDENT')
@Controller({ path: 'portal/forms', version: '1' })
export class PortalFormsController {
  constructor(
    private readonly scopes: PortalScopeService,
    private readonly forms: PortalFormsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'The signed-in resident’s forms: to sign, or signed' })
  async list(@CurrentUser() user: CurrentUserPayload) {
    return this.forms.list(await this.scopes.resolve(user))
  }

  @Get(':packageId')
  @ApiOperation({ summary: 'The resident’s copy (the combined document for a representation member)' })
  async copy(@CurrentUser() user: CurrentUserPayload, @Param('packageId') packageId: string) {
    return this.forms.copy(await this.scopes.resolve(user), packageId)
  }
}
