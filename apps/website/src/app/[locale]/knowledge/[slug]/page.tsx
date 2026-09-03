import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import type { Locale } from '@urban-renewal/api-contracts'
import { getArticleBySlug } from '@/mock'
import { PageHeader } from '@/components/blocks/page-header'
import { Section } from '@/components/blocks/section'
import { getCmsArticleBySlug, getPublicMediaUrl } from '@/lib/cms-source'
import { makeLocalizer } from '@/lib/localize'

/**
 * Knowledge article detail.
 *
 * ── CMS FIRST, THEN THE PRE-EXISTING MOCK REPOSITORY ────────────────────────
 *
 * Pass 4G's Knowledge Center is empty until someone publishes a real article
 * — see `/knowledge/page.tsx` — so this checks the CMS by slug first, exactly
 * the resolver pattern `getCmsPage` uses.
 *
 * Before this pass, this route always 404'd or (once a scaffold existed)
 * rendered `PageShell` regardless of whether a match existed, even though
 * `getArticleBySlug` already resolves real titles and summaries — the
 * homepage's own Knowledge teaser links here with those same slugs. A visitor
 * who reached this page from a live, public teaser therefore hit an internal
 * "Page shell" notice. That is fixed here by actually rendering what the
 * repository already returns, in the same honest layout a CMS article gets.
 *
 * This does not promote `MOCK_ARTICLES` into the CMS or claim it is reviewed
 * content — it renders what was already being shown as a summary on the
 * homepage, completing a route that a live link already pointed at.
 */
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
    }
  }
  const article = await getArticleBySlug(slug)
  if (!article) return {}
  return { title: article.title, description: article.summary }
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
    const imageUrl = cms.featuredImage ? await getPublicMediaUrl(cms.featuredImage.storageKey) : null
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
            <img
              src={imageUrl}
              alt={loc.text(cms.featuredImage!.alt)}
              className="mb-8 h-64 w-full rounded-xl border border-gray-200 object-cover sm:h-80"
            />
          )}
          {cms.featuredImage && cms.featuredImage.classification !== 'VERIFIED_PROJECT_PHOTO' && (
            <p className="mb-6 text-xs text-gray-500">תצלום הקשר. אינו מתאר פרויקט של OpenDoor.</p>
          )}
          <div className="prose prose-gray max-w-prose">
            {bodyParagraphs.length > 0
              ? bodyParagraphs.map((p, i) => (
                  <p key={i} className="text-base leading-relaxed text-gray-700">{p}</p>
                ))
              : <p className="text-base text-gray-500">תוכן הכתבה בהכנה.</p>}
          </div>
        </Section>
      </>
    )
  }

  const article = await getArticleBySlug(slug)
  if (!article) notFound()

  return (
    <>
      <PageHeader title={article.title} standfirst={article.summary} />
      <Section size="md">
        <div className="prose prose-gray max-w-prose">
          {article.body.split(/\n{2,}/).filter(Boolean).map((p, i) => (
            <p key={i} className="text-base leading-relaxed text-gray-700">{p}</p>
          ))}
        </div>
      </Section>
    </>
  )
}
