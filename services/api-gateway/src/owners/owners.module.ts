import { Module } from '@nestjs/common'
import { OwnersController, OwnersBulkController } from './owners.controller'
import { OwnersService } from './owners.service'

@Module({
  controllers: [OwnersController, OwnersBulkController],
  providers: [OwnersService],
  exports: [OwnersService],
})
export class OwnersModule {}
