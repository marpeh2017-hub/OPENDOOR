import { Module } from '@nestjs/common'
import { SignaturesModule } from '../signatures/signatures.module'
import { PortalModule } from '../portal/portal.module'
import { FormsController } from './forms.controller'
import { PortalFormsController } from './portal-forms.controller'
import { FormsService } from './forms.service'
import { PortalFormsService } from './portal-forms.service'
import { FormLinkSender } from './form-link.sender'

/**
 * Digital forms on top of signature packages: the signing flow, its one-time
 * codes and its evidence come from SignaturesModule; the resident's scope
 * from PortalModule.
 */
@Module({
  imports: [SignaturesModule, PortalModule],
  controllers: [FormsController, PortalFormsController],
  providers: [FormsService, PortalFormsService, FormLinkSender],
})
export class FormsModule {}
