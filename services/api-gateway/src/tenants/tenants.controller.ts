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
  create(@Body() body: any) {
    return this.prisma.tenant.create({ data: body })
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN','COMPANY_ADMIN')
  @ApiOperation({ summary: 'Update a tenant' })
  async update(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    if (req.user.role === 'COMPANY_ADMIN' && req.user.tenantId !== id) {
      throw new NotFoundException('Tenant not found')
    }
    return this.prisma.tenant.update({ where: { id }, data: body })
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Delete a tenant (SUPER_ADMIN only)' })
  remove(@Param('id') id: string) {
    return this.prisma.tenant.delete({ where: { id } })
  }
}
