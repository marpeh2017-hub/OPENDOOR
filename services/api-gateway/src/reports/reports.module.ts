import { Module } from '@nestjs/common'
import { FormsModule } from '../forms/forms.module'
import { ReportsController } from './reports.controller'
import { ReportsService } from './reports.service'
import { ReportCatalog } from './report-catalog'

@Module({
  imports: [FormsModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportCatalog],
})
export class ReportsModule {}
