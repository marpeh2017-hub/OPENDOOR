import { Module } from '@nestjs/common'
import { TemplatesController } from './templates.controller'
import { TemplatesService } from './templates.service'

/**
 * The communication template library.
 *
 * Exports `TemplatesService` because the automations engine and the messaging
 * dispatcher both need to resolve and render a template without going back out
 * through HTTP.
 */
@Module({
  controllers: [TemplatesController],
  providers: [TemplatesService],
  exports: [TemplatesService],
})
export class TemplatesModule {}
