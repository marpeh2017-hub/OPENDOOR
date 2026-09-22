import { CreateTenantDto, UpdateTenantDto } from './dto/tenant.dto'
import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Request, NotFoundException,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { Roles } from '../auth/decorators/roles.decorator'
import { PrismaService } from '../prisma.service'

@ApiTags('tenants')
@ApiBearerAuth()
@Controller({ path: 'tenants', version: '1' })
export class TenantsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'List all tenants (SUPER_ADMIN only)' })
  findAll() {
    return this.prisma.tenant.findMany({ orderBy: { createdAt: 'desc' } })
  }

  @Get(':id')
  @Roles('SUPER_ADMIN','COMPANY_ADMIN')
  @ApiOperation({ summary: 'Get a tenant' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    // COMPANY_ADMIN can only see their own tenant
    if (req.user.role === 'COMPANY_ADMIN' && req.user.tenantId !== id) {
      throw new NotFoundException('Tenant not found')
    }
    const tenant = await this.prisma.tenant.findUnique({ where: { id } })
    if (!tenant) throw new NotFoundException('Tenant not found')
    return tenant
  }

  @Post()
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Create a tenant (SUPER_ADMIN only)' })
  create(@Body() dto: CreateTenantDto) {
    return this.prisma.tenant.create({ data: { ...dto, settings: dto.settings as never, features: dto.features as never } })
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN','COMPANY_ADMIN')
  @ApiOperation({ summary: 'Update a tenant' })
  async update(@Param('id') id: string, @Body() dto: UpdateTenantDto, @Request() req: any) {
    /*
     * The tenant IS the row here, so there is no cross-tenant move to
     * prevent — a COMPANY_ADMIN is already pinned to its own id above. What
     * the DTO adds is that only the columns the product means to expose can
     * be written: `@Body() body: any` made every column on the tenant
     * client-writable, retention included, and retention drives deletes.
     */
    if (req.user.role === 'COMPANY_ADMIN' && req.user.tenantId !== id) {
      throw new NotFoundException('Tenant not found')
    }
    return this.prisma.tenant.update({ where: { id }, data: { ...dto, settings: dto.settings as never, features: dto.features as never } })
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Delete a tenant (SUPER_ADMIN only)' })
  remove(@Param('id') id: string) {
    return this.prisma.tenant.delete({ where: { id } })
  }
}
