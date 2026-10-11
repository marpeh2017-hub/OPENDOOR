import { Module } from '@nestjs/common'
import { SignaturesModule } from '../signatures/signatures.module'
import { PortalModule } from '../portal/portal.module'
import { LeadsModule } from '../leads/leads.module'
import { FormsController } from './forms.controller'
import { PortalFormsController } from './portal-forms.controller'
import { FormsService } from './forms.service'
import { PortalFormsService } from './portal-forms.service'
import { FormLinkSender } from './form-link.sender'
import { PublicFormsService } from './public-forms.service'
import { PublicFormsController } from './public-forms.controller'
import { WebsiteFormsController } from './website-forms.controller'

/**
 * Digital forms on top of signature packages: the signing flow, its one-time
 * codes and its evidence come from SignaturesModule; the resident's scope
 * from PortalModule; the website's started protocols create their lead
 * through LeadsModule's public intake.
 */
@Module({
  imports: [SignaturesModule, PortalModule, LeadsModule],
  controllers: [FormsController, PortalFormsController, PublicFormsController, WebsiteFormsController],
  providers: [FormsService, PortalFormsService, FormLinkSender, PublicFormsService],
})
export class FormsModule {}
