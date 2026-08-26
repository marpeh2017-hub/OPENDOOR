import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Request, Query,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger'
import { Roles } from '../auth/decorators/roles.decorator'
import { ADMIN_ROLES } from '../auth/roles.constants'
import { UsersService } from './users.service'
import { actorFrom, tenantFrom } from '../common/actor'
import { mapDomainErrors } from '../common/errors/domain-error'
import {
  CreateUserDto, UpdateUserDto, ChangeUserRoleDto, SetUserActiveDto, ResetUserPasswordDto,
} from './dto/user.dto'

/**
 * User management.
 *
 * Every endpoint is ADMIN_ROLES (SUPER_ADMIN / COMPANY_ADMIN) — the CRM hides
 * the controls for everyone else, but THIS is the enforcement. Granting
 * SUPER_ADMIN is further restricted inside the service.
 *
 * No response on this controller can contain `passwordHash`, `mfaSecret` or a
 * token: the service selects an explicit public field list.
 */
@ApiTags('users')
@ApiBearerAuth()
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'List users in the tenant (admin)' })
  @ApiQuery({ name: 'role', required: false })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false })
  findAll(
    @Request() req: any,
    @Query('role') role?: string,
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
  ) {
    return mapDomainErrors(() =>
      this.users.findAll(tenantFrom(req), {
        role,
        isActive: isActive === undefined ? undefined : isActive === 'true',
        search,
      }),
    )
  }

  @Get(':id')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Get a user with project memberships (admin)' })
  findOne(@Param('id') id: string, @Request() req: any) {
    return mapDomainErrors(() => this.users.findOne(id, tenantFrom(req)))
  }

  @Post()
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Create a user (admin)' })
  create(@Body() dto: CreateUserDto, @Request() req: any) {
    return mapDomainErrors(() => this.users.create(dto, actorFrom(req)))
  }

  @Patch(':id')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Update a user profile (admin)' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @Request() req: any) {
    return mapDomainErrors(() => this.users.update(id, dto, actorFrom(req)))
  }

  @Patch(':id/role')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Change a user role (admin; SUPER_ADMIN grant is SUPER_ADMIN only)' })
  changeRole(@Param('id') id: string, @Body() dto: ChangeUserRoleDto, @Request() req: any) {
    return mapDomainErrors(() => this.users.changeRole(id, dto, actorFrom(req)))
  }

  @Patch(':id/active')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Activate or deactivate a user (admin)' })
  setActive(@Param('id') id: string, @Body() dto: SetUserActiveDto, @Request() req: any) {
    return mapDomainErrors(() => this.users.setActive(id, dto, actorFrom(req)))
  }

  @Post(':id/password')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Set a user password (admin). Revokes all sessions.' })
  resetPassword(@Param('id') id: string, @Body() dto: ResetUserPasswordDto, @Request() req: any) {
    return mapDomainErrors(() => this.users.resetPassword(id, dto, actorFrom(req)))
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Deactivate a user (SUPER_ADMIN). Soft — audit history is preserved.',
  })
  remove(@Param('id') id: string, @Request() req: any) {
    return mapDomainErrors(() => this.users.deactivateInsteadOfDelete(id, actorFrom(req)))
  }
}
