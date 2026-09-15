import { Module } from '@nestjs/common'
import { CmsController } from './cms.controller'
import { CmsPublicController } from './cms-public.controller'
import { CmsService } from './cms.service'
import { DocumentsModule } from '../documents/documents.module'

/**
 * The Site Manager.
 *
 * Two controllers, deliberately: `CmsController` is the authenticated editing
 * surface, `CmsPublicController` is everything the open internet can reach.
 * Keeping them apart means the public surface is one short file a reviewer can
 * read end to end, rather than a handful of `@Public()` methods scattered
 * among authorised ones.
 *
 * The CMS reads and writes its own tables and projects its own output; it
 * does not reach into projects, residents or feasibility, and nothing reaches
 * into it beyond the one dependency below. That isolation is the point — the
 * blast radius of an editorial mistake should stop at the website.
 */
@Module({
  // `DocumentsModule` is imported for its exported `MalwareScanService` only —
  // project media upload is the second place untrusted bytes enter the
  // system, and it reuses the same scanner rather than a second instance.
  // `StorageService` needs no import: `StorageModule` is `@Global()`.
  imports: [DocumentsModule],
  controllers: [CmsController, CmsPublicController],
  providers: [CmsService],
  exports: [CmsService],
})
export class CmsModule {}
