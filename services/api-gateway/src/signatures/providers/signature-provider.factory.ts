import { Logger } from '@nestjs/common'
import { SignatureProvider } from './signature-provider.interface'
import { MockSignatureProvider } from './mock-signature.provider'
import { NativeSignatureProvider } from './native-signature.provider'

const logger = new Logger('SignatureProviderFactory')

export function createSignatureProvider(): SignatureProvider {
  if (process.env.COMSIGN_API_KEY) {
    logger.log('COMSIGN_API_KEY detected — ComSign provider implementation pending')
    // TODO: implement ComSignProvider when ComSign SDK credentials are available
    throw new Error(
      'ComSign provider implementation pending — remove COMSIGN_API_KEY to fall back to NATIVE, or add ComSignProvider to signature-provider.factory.ts',
    )
  }

  if (process.env.DOCUSIGN_CLIENT_ID) {
    logger.log('DOCUSIGN_CLIENT_ID detected — DocuSign provider implementation pending')
    // TODO: implement DocuSignProvider when DocuSign SDK credentials are available
    throw new Error(
      'DocuSign provider implementation pending — remove DOCUSIGN_CLIENT_ID to fall back to NATIVE, or add DocuSignProvider to signature-provider.factory.ts',
    )
  }

  if (process.env.NODE_ENV === 'test') {
    logger.log('Test environment — using MockSignatureProvider')
    return new MockSignatureProvider()
  }

  // Default: NativeSignatureProvider — production-ready for Israeli regular e-signatures
  logger.log('Using NativeSignatureProvider (SMS OTP-based, legally valid for regular e-signatures in Israel)')
  return new NativeSignatureProvider()
}
