import type { HeroBlock } from '@urban-renewal/api-contracts'
import { Link } from '@/i18n/navigation'
import type { Localizer } from '@/lib/localize'
import { ImageGallery } from '@/components/brand/image-gallery'
import { getSlotGallery } from '@/mock/fixtures/images'

/** The opening image sequence is managed by the existing CMS image-slots document. */
export async function HeroBlockView({ block, t }: { block: HeroBlock; t: Localizer }) {
  const images = await getSlotGallery('HERO_JERUSALEM_ARCHITECTURE')
  return (
    <section className="bg-white">
      <ImageGallery priority images={images.map((image) => ({ id: image.id, src: image.url, alt: t.text(image.alt) }))}
        labels={{
          gallery: t({ he: 'תמונות פתיחת האתר', en: 'Homepage gallery' }),
          previous: t({ he: 'התמונה הקודמת', en: 'Previous image' }),
          next: t({ he: 'התמונה הבאה', en: 'Next image' }),
          pause: t({ he: 'עצירת החלפת תמונות', en: 'Pause slideshow' }),
          play: t({ he: 'הפעלת החלפת תמונות', en: 'Play slideshow' }),
          image: t({ he: 'תמונה', en: 'Image' }),
        }} />
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 md:grid-cols-[1fr_auto] md:items-center lg:px-8 lg:py-10">
        <div>
          <h1 className="max-w-[24ch] text-balance text-4xl font-bold leading-tight tracking-tight text-gray-900 lg:text-5xl">{t(block.heading)}</h1>
          {block.subheading && <p className="mt-4 max-w-2xl text-lg leading-relaxed text-gray-600">{t(block.subheading)}</p>}
        </div>
        <div className="flex flex-col items-start gap-3">
          <Link href={block.primaryCtaHref} className="inline-flex min-h-12 items-center justify-center rounded-md bg-teal-600 px-7 py-4 text-base font-semibold text-white hover:bg-teal-700">{t(block.primaryCtaLabel)}</Link>
          {block.secondaryCtaLabel && block.secondaryCtaHref && <Link href={block.secondaryCtaHref} className="inline-flex min-h-11 items-center text-sm font-semibold text-teal-700 underline underline-offset-4">{t(block.secondaryCtaLabel)}</Link>}
        </div>
        {block.note && <p className="text-sm leading-relaxed text-gray-600 md:col-span-2">{t(block.note)}</p>}
      </div>
    </section>
  )
}
