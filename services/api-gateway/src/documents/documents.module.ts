import { Module } from '@nestjs/common'
import { DocumentsController } from './documents.controller'
import { MalwareScanService } from './malware/malware-scan.service'

/**
 * `MalwareScanService` is provided here rather than globally: the document
 * upload path is the only place untrusted bytes enter the system, and keeping
 * the scanner scoped to it makes that boundary explicit.
 */
@Module({
  controllers: [DocumentsController],
  providers: [MalwareScanService],
  exports: [MalwareScanService],
})
export class DocumentsModule {}
