import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import type { Locale, PageBlock } from '@urban-renewal/api-contracts'
import { getExternalResources } from '@/mock'
import { makeLocalizer } from '@/lib/localize'
import { PageBlocks } from '@/components/blocks/page-blocks'

/**
 * Preview an unpublished page through a signed, expiring link.
 *
 * ── WHY THIS RENDERS THE PROJECTION AND NOT THE DRAFT ──────────────────────
 *
 * The gateway returns both. This renders `projection` — what publishing WOULD
 * put on the website — because that is the question a preview is asked to
 * answer. A preview of the raw draft would happily show an internal note or an
 * unverified figure that publishing is going to drop, so the reviewer would
 * approve a page they had never actually seen.
 *
 * ── WHY IT IS noindex TWICE ────────────────────────────────────────────────
 *
 * The gateway sets `X-Robots-Tag` on its JSON, which does nothing for this
 * HTML page: headers do not travel through a server-side fetch. So the page
 * declares its own robots metadata. A preview URL that reached an index would
 * outlive its token in the cache — the token expires in an hour, a search
 * result does not.
 *
 * Rendering goes through the SAME `PageBlocks` component as the live route, so
 * a preview cannot disagree with the published page about how a block looks.
 */
export const metadata: Metadata = {
  title: 'תצוגה מקדימה',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
}

// A preview is per-token and short-lived; caching it would serve one reviewer's
// link to the next one.
export const dynamic = 'force-dynamic'

interface PreviewResponse {
  id: string
  slug: string
  state: string
  projection: { blocks?: PageBlock[] }
}

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>
}) {
  const { locale, token } = await params
  setRequestLocale(locale)

  const base = process.env['NEXT_PUBLIC_API_URL']?.replace(/\/+$/, '')
  if (!base) notFound()

  const res = await fetch(`${base}/api/v1/public/cms/preview/${encodeURIComponent(token)}`, {
    cache: 'no-store',
  })
  // An invalid, expired or tampered token is indistinguishable from a page that
  // does not exist, which is what the gateway already decided and this must not
  // undo by rendering a more specific error.
  if (!res.ok) notFound()

  const body = (await res.json()) as PreviewResponse
  const blocks = body?.projection?.blocks
  if (!Array.isArray(blocks) || blocks.length === 0) notFound()

  const t = makeLocalizer(locale as Locale)
  const resources = await getExternalResources()
  const visible = blocks.filter((b) => !b.hidden).slice().sort((a, b) => a.order - b.order)

  return (
    <>
      {/*
        Unmissable, and above the content rather than floating over it: a
        reviewer who mistakes a preview for the live site will report a bug
        that does not exist, or worse, believe a change is live when it is not.
      */}
      <div className="bg-[#f4f1ec] px-4 py-3 text-center">
        <p className="text-[13px] font-semibold text-[#7d6234]">
          תצוגה מקדימה. העמוד אינו מפורסם ואינו גלוי לציבור.
        </p>
        <p className="mt-0.5 text-[12px] text-[#7d6234]">
          זהו מה שיופיע באתר אם העמוד יפורסם. הקישור פג תוקף בתוך שעה.
        </p>
      </div>
      <PageBlocks blocks={visible} t={t} resources={resources} />
    </>
  )
}
