import { Module } from '@nestjs/common'
import { CmsController } from './cms.controller'
import { CmsPublicController } from './cms-public.controller'
import { CmsService } from './cms.service'

/**
 * The Site Manager.
 *
 * Two controllers, deliberately: `CmsController` is the authenticated editing
 * surface, `CmsPublicController` is everything the open internet can reach.
 * Keeping them apart means the public surface is one short file a reviewer can
 * read end to end, rather than a handful of `@Public()` methods scattered
 * among authorised ones.
 *
 * No dependencies. The CMS reads and writes its own tables and projects its
 * own output; it does not reach into projects, residents or feasibility, and
 * nothing reaches into it. That isolation is the point — the blast radius of
 * an editorial mistake should stop at the website.
 */
@Module({
  controllers: [CmsController, CmsPublicController],
  providers: [CmsService],
  exports: [CmsService],
})
export class CmsModule {}
