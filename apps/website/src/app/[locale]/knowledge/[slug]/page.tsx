import { SafeImage } from '@/components/brand/safe-image'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import type { Locale } from '@urban-renewal/api-contracts'
import { PageHeader } from '@/components/blocks/page-header'
import { Section } from '@/components/blocks/section'
import { getCmsArticleBySlug, getPublicMediaUrl } from '@/lib/cms-source'
import { makeLocalizer } from '@/lib/localize'

/** Published CMS articles only. Unapproved fixtures never reach this route. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale, slug } = await params
  const cms = await getCmsArticleBySlug(slug)
  if (cms) {
    return {
      title: cms.seo?.[locale]?.title ?? cms.title.he,
      description: cms.seo?.[locale]?.description ?? cms.summary?.he,
      ...(cms.seo?.[locale]?.noIndex ? { robots: { index: false, follow: true } } : {}),
    }
  }
  return { robots: { index: false, follow: false } }
}

export default async function KnowledgeArticlePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  setRequestLocale(locale)
  const loc = makeLocalizer(locale as Locale)

  const cms = await getCmsArticleBySlug(slug)
  if (cms) {
    const imageUrl = cms.featuredImage
      ? await getPublicMediaUrl(cms.featuredImage.storageKey)
      : null
    const bodyParagraphs = (loc.translated(cms.body) ?? '').split(/\n{2,}/).filter(Boolean)
    return (
      <>
        <PageHeader
          title={loc.text(cms.title)}
          standfirst={cms.summary ? loc.translated(cms.summary) : undefined}
        />
        <Section size="md">
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <SafeImage
              src={imageUrl}
              alt={loc.text(cms.featuredImage!.alt)}
              className="mb-8 h-64 w-full rounded-xl border border-gray-200 object-cover sm:h-80"
            />
          )}
          {imageUrl &&
            cms.featuredImage &&
            cms.featuredImage.classification !== 'VERIFIED_PROJECT_PHOTO' && (
              <p className="mb-6 text-xs text-gray-500">
                תצלום הקשר. אינו מתאר פרויקט של OpenDoor.
              </p>
            )}
          <div className="prose prose-gray max-w-prose">
            {bodyParagraphs.length > 0
              ? bodyParagraphs.map((p, i) => (
                  <p key={i} className="text-base leading-relaxed text-gray-700">
                    {p}
                  </p>
                ))
              : null}
          </div>
        </Section>
      </>
    )
  }

  notFound()
}
