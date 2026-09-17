import { Module } from '@nestjs/common'
import { FeasibilityController } from './feasibility.controller'
import { FeasibilityCalculationService } from './feasibility-calculation.service'
import { FeasibilityReportVersionService } from './feasibility-report-version.service'
import { FeasibilityExcelExportService } from './feasibility-excel-export.service'
import { FeasibilityPdfExportService } from './feasibility-pdf-export.service'
import { FeasibilityService } from './feasibility.service'
import { FeasibilityRulesController } from './feasibility-rules.controller'
import { FeasibilityRulesService } from './feasibility-rules.service'

@Module({
  controllers: [FeasibilityController, FeasibilityRulesController],
  providers: [FeasibilityService, FeasibilityRulesService, FeasibilityCalculationService, FeasibilityReportVersionService, FeasibilityExcelExportService, FeasibilityPdfExportService],
  exports: [FeasibilityService, FeasibilityRulesService, FeasibilityCalculationService, FeasibilityReportVersionService, FeasibilityExcelExportService, FeasibilityPdfExportService],
})
export class FeasibilityModule {}
