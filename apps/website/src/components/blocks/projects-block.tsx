import type { CollectionBlock, PublicProjectSummary } from '@urban-renewal/api-contracts'
import { Link } from '@/i18n/navigation'
import { getTranslations } from 'next-intl/server'
import { Section, SectionHeading } from './section'
import type { Localizer } from '@/lib/localize'
import { ProjectPattern, STROKE } from '@/components/brand/architecture'

/**
 * Projects.
 *
 * ── THE CARD STILL WORKS WITH ALMOST NOTHING ───────────────────────────────
 *
 * Name, city, one sentence. That is all a card is guaranteed to have: most
 * projects carry no verified stage, and none carry unit counts, signature
 * percentages, developer names or approvals. Remove every optional field and
 * the card must still read as finished. That constraint is unchanged from V1
 * and it is the reason there are no statistics here.
 *
 * ── WHAT V2 ADDS: INDIVIDUALITY WITHOUT INFORMATION ────────────────────────
 *
 * V1's cards shared one identical placeholder drawing, which is precisely why
 * they read as placeholders — three identical marks say "image missing" far
 * more loudly than no image would.
 *
 * Each project now gets a mark generated from its slug: different volume
 * counts, heights, opening positions, line densities and crops. The marks are
 * visibly the same family and visibly not the same drawing. Critically, the
 * variation encodes NOTHING — see `ProjectPattern` for why that is a hard
 * requirement rather than a shrug.
 *
 * ── ASYMMETRY ──────────────────────────────────────────────────────────────
 *
 * One project leads at double width, two follow. The lead is chosen by the
 * `featured` flag that already exists in the content model — it is an editorial
 * decision recorded by whoever curates the list, not a claim that the project
 * is larger, further along or more successful. No "why featured" is displayed,
 * because no such reason has been verified.
 *
 * If nothing is flagged, the first item leads. The layout never depends on data
 * that might be absent.
 */
export async function ProjectsBlockView({
  block,
  projects,
  t,
}: {
  block: CollectionBlock
  projects: PublicProjectSummary[]
  t: Localizer
}) {
  const [tLinks, tStages] = await Promise.all([
    getTranslations('links'),
    getTranslations('stages'),
  ])

  /**
   * Nothing published → render nothing at all.
   *
   * Not an empty grid, not a "0 projects" line, not a skeleton. The homepage
   * is a continuous argument, and a section that announces its own emptiness
   * interrupts it to say something the visitor did not ask about. `/projects`
   * has a designed empty state because someone who navigated there is owed an
   * explanation; someone scrolling the homepage is not.
   *
   * This is also the correct behaviour the day a real project is unpublished,
   * which is why it lives here rather than in a temporary flag.
   */
  if (projects.length === 0) return null

  const leadIndex = Math.max(0, projects.findIndex((p) => p.featured))
  const lead = projects[leadIndex]
  const rest = projects.filter((_, index) => index !== leadIndex)

  return (
    <Section size="lg">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <SectionHeading heading={block.heading} intro={block.intro} t={t} size="lg" />
        <Link
          href="/projects"
          className="group inline-flex items-center gap-2 text-sm font-semibold text-teal-700"
        >
          <span className="border-b border-transparent pb-0.5 transition-colors group-hover:border-teal-700">
            {tLinks('allProjects')}
          </span>
          <span
            aria-hidden="true"
            className="inline-block transition-transform duration-200 group-hover:translate-x-[3px] rtl:rotate-180"
          >
            →
          </span>
        </Link>
      </div>

      {lead && (
        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          <ProjectCard project={lead} lead stageLabel={tStages} />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
            {rest.map((project) => (
              <ProjectCard key={project.id} project={project} stageLabel={tStages} />
            ))}
          </div>
        </div>
      )}
    </Section>
  )
}

/**
 * One project.
 *
 * `lead` changes the proportion and the type scale — not the information. A
 * larger card must never be a card that says more, or "featured" would start
 * to imply "further along".
 *
 * The whole card is one link. Hover and focus land on the same element, so the
 * mark's response is available to keyboard users, and `focus-visible:` styling
 * on the anchor gives a visible ring without one appearing on mouse click.
 */
function ProjectCard({
  project,
  lead = false,
  stageLabel,
}: {
  project: PublicProjectSummary
  lead?: boolean
  stageLabel: (key: string) => string
}) {
  return (
    <Link
      href={`/projects/${project.slug}`}
      className={`group relative flex flex-col overflow-hidden bg-white outline-none transition-colors focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 ${
        lead ? 'lg:col-span-2' : ''
      }`}
    >
      {/* Frame: hairline on three sides, teal on the reading edge, which
          thickens on hover. The interrupted top edge is the door motif again. */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 z-10">
        <span className="absolute start-0 top-0 h-px w-[22%]" style={{ background: STROKE.teal }} />
        <span className="absolute end-0 top-0 h-px w-[58%]" style={{ background: STROKE.faint }} />
        <span className="absolute bottom-0 start-0 h-px w-full" style={{ background: STROKE.faint }} />
        <span className="absolute bottom-0 start-0 top-0 w-px transition-colors duration-200 group-hover:bg-teal-500 group-focus-visible:bg-teal-500" style={{ background: STROKE.faint }} />
        <span className="absolute bottom-0 end-0 top-0 w-px" style={{ background: STROKE.faint }} />
      </span>

      <div
        className={`relative overflow-hidden bg-surface-sunken ${
          lead ? 'aspect-[16/9] lg:aspect-[21/9]' : 'aspect-[16/9]'
        }`}
      >
        {/* The mark drifts a few pixels on hover — the composition responding,
            not the card lifting. Card-lift shadows are the SaaS tell. */}
        <div className="h-full w-full transition-transform duration-500 ease-out group-hover:scale-[1.03] group-focus-visible:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100">
          <ProjectPattern slug={project.slug} />
        </div>
      </div>

      <div className={`flex flex-1 flex-col ${lead ? 'p-6 lg:p-8' : 'p-5'}`}>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
          {project.location.city}
        </p>
        <h3
          className={`mt-2 font-semibold text-gray-900 transition-colors group-hover:text-teal-800 ${
            lead ? 'text-2xl lg:text-3xl' : 'text-lg'
          }`}
        >
          {project.name}
        </h3>
        <p
          className={`mt-3 flex-1 leading-relaxed text-gray-600 ${
            lead ? 'max-w-xl text-base' : 'text-sm'
          }`}
        >
          {project.summary}
        </p>

        {/* Only when a stage is actually verified. Absent is the norm. */}
        {/* `.value` unwraps the VerifiedFact. The wrapper travels this far so
            that a stage can never be displayed without a verification record
            existing behind it — reading `.value` is the deliberate act of
            saying "this has been confirmed". */}
        {project.currentStage && (
          <p className="mt-5 inline-flex w-fit items-center gap-2 border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700">
            <span aria-hidden="true" className="h-1.5 w-1.5 rotate-45 bg-teal-600" />
            {stageLabel(project.currentStage.value)}
          </p>
        )}
      </div>
    </Link>
  )
}
