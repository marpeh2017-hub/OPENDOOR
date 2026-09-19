import { Module } from '@nestjs/common'
import {
  BuildingsController, BuildingsBulkController,
  ComplexesController, ApartmentsController,
} from './buildings.controller'
import { BuildingsService } from './buildings.service'

@Module({
  controllers: [
    BuildingsController, BuildingsBulkController,
    ComplexesController, ApartmentsController,
  ],
  providers: [BuildingsService],
  exports: [BuildingsService],
})
export class BuildingsModule {}
