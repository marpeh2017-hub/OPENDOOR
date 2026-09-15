import { Module } from '@nestjs/common'
import { ImportsController } from './imports.controller'
import { ImportsService } from './imports.service'
import { ExcelParserService } from './excel-parser.service'
import { ImportValidationService } from './import-validation.service'
import { OwnersModule } from '../owners/owners.module'
import { ResidentsModule } from '../residents/residents.module'
import { StorageModule } from '../storage/storage.module'

/**
 * Excel import.
 *
 * Imports `OwnersModule` and `ResidentsModule` rather than talking to Prisma
 * for those entities directly — that dependency is the mechanism enforcing the
 * rule that the import owns no business logic of its own. The write path goes
 * through `OwnersService.applyImportBatch` / `ResidentsService.applyImportBatch`,
 * which sit beside the manual single-row methods and call the same
 * `NationalIdService` and `AuditService`.
 *
 * `OwnershipService`, `TenantScopeService`, `NationalIdService` and
 * `AuditService` arrive via the global `CommonModule` and are not re-provided
 * here; a second instance would be a second copy of the rules.
 */
@Module({
  imports: [OwnersModule, ResidentsModule, StorageModule],
  controllers: [ImportsController],
  providers: [ImportsService, ExcelParserService, ImportValidationService],
  exports: [ImportsService],
})
export class ImportsModule {}
