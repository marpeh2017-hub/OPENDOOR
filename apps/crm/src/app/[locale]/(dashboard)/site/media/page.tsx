import { MediaLibrary } from '@/components/site/media-library'
import { ImageSlotsEditor } from '@/components/site/image-slots-editor'

/**
 * Two managed content rows on one screen, deliberately: the library (what
 * images exist) and slot assignment (where the seven controlled positions on
 * the website point). Each has its own Save/Publish/History because each is
 * its own `CmsContent` row — assigning a slot does not require republishing
 * the whole library, and vice versa.
 */
export default function SiteMediaPage() {
  return (
    <div className="space-y-8">
      <MediaLibrary />
      <hr className="border-border" />
      <ImageSlotsEditor />
    </div>
  )
}
