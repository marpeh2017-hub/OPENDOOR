import { Module } from '@nestjs/common'
import { FeasibilityController } from './feasibility.controller'
import { FeasibilityCalculationService } from './feasibility-calculation.service'
import { FeasibilityReportVersionService } from './feasibility-report-version.service'
import { FeasibilityExcelExportService } from './feasibility-excel-export.service'
import { FeasibilityPdfExportService } from './feasibility-pdf-export.service'
import { FeasibilityService } from './feasibility.service'

@Module({
  controllers: [FeasibilityController],
  providers: [FeasibilityService, FeasibilityCalculationService, FeasibilityReportVersionService, FeasibilityExcelExportService, FeasibilityPdfExportService],
  exports: [FeasibilityService, FeasibilityCalculationService, FeasibilityReportVersionService, FeasibilityExcelExportService, FeasibilityPdfExportService],
})
export class FeasibilityModule {}
