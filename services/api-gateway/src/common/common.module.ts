import { Module, Global } from '@nestjs/common'
import { AuditService } from './audit/audit.service'
import { TenantScopeService } from './tenant/tenant-scope.service'
import { OwnershipService } from './ownership/ownership.service'
import { NationalIdService } from './pii/national-id.service'

/**
 * Shared domain services.
 *
 * Global, like CryptoModule, because these are cross-cutting rules rather than
 * a feature area: every entity module needs tenant scoping and auditing, and
 * ownership arithmetic must have exactly one implementation shared by manual
 * CRUD, Data Quality, the threshold engine and Excel import.
 */
@Global()
@Module({
  providers: [AuditService, TenantScopeService, OwnershipService, NationalIdService],
  exports: [AuditService, TenantScopeService, OwnershipService, NationalIdService],
})
export class CommonModule {}
