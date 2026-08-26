import { Module } from '@nestjs/common'
import { AutomationsModule } from '../automations/automations.module'
import { SignaturesController }          from './signatures.controller'
import { SignatureWebhookController }    from './signature-webhook.controller'
import { ThresholdService }              from './threshold.service'
import { SignaturePackageService }       from './signature-package.service'
import { SignatureStateMachineService }  from './signature-state-machine.service'
import { SigningSessionService }         from './signing-session.service'
import { EvidencePackageService }        from './evidence-package.service'
import { EvidencePdfService }            from './evidence-pdf.service'
import { SignatureExpiryService }        from './signature-expiry.service'
import { createSignatureProvider }       from './providers/signature-provider.factory'

@Module({
  imports: [AutomationsModule, ],
  controllers: [SignaturesController, SignatureWebhookController],
  providers: [
    ThresholdService,
    SignatureStateMachineService,
    EvidencePdfService,
    EvidencePackageService,
    SigningSessionService,
    SignaturePackageService,
    SignatureExpiryService,
    { provide: 'SIGNATURE_PROVIDER', useFactory: createSignatureProvider },
  ],
  exports: [ThresholdService, SignaturePackageService, EvidencePackageService],
})
export class SignaturesModule {}
