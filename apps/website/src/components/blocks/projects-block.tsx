import type { CollectionBlock, PublicProjectSummary } from '@urban-renewal/api-contracts'
import { Link } from '@/i18n/navigation'
import { getTranslations } from 'next-intl/server'
import { Section, SectionHeading } from './section'
import type { Localizer } from '@/lib/localize'

/**
 * Project preview.
 *
 * ── THE CARD WORKS WITH ALMOST NOTHING ─────────────────────────────────────
 *
 * Name, city, one sentence. That is all a card is guaranteed to have, because
 * most projects carry no verified stage and none carry unit counts, signature
 * percentages, developer names or approvals.
 *
 * So the layout is built around the type: the placeholder mark sits at a fixed
 * ratio, the name is the dominant element, the city is a quiet line above it,
 * and the stage chip appears ONLY when a stage exists. Remove every optional
 * field and the card still reads as finished — which is the test the brief set,
 * and the reason this is not a stat-bearing tile.
 *
 * Cards are used here, unlike the feature sections, because a project IS a
 * discrete object a visitor clicks. A border earns its place when it defines a
 * target.
 */
export async function ProjectsBlockView({
  block, projects, t, tone,
}: {
  block: CollectionBlock
  projects: PublicProjectSummary[]
  t: Localizer
  tone?: 'page' | 'raised' | 'sunken'
}) {
  // Stage labels and link text are UI chrome, so they live in the message
  // catalogue rather than in this file — otherwise the English page renders
  // Hebrew, which is exactly what happened before this change.
  const [tLinks, tStages] = await Promise.all([
    getTranslations('links'),
    getTranslations('stages'),
  ])

  return (
    <Section tone={tone}>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <SectionHeading heading={block.heading} intro={block.intro} t={t} />
        <Link
          href="/projects"
          className="text-sm font-semibold text-teal-700 underline-offset-4 hover:underline"
        >
          {tLinks('allProjects')} →
        </Link>
      </div>

      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <Link
            key={project.id}
            href={`/projects/${project.slug}`}
            className="group flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white transition-colors hover:border-teal-300"
          >
            <ProjectPlaceholder name={project.name} />

            <div className="flex flex-1 flex-col p-5">
              <p className="text-xs font-medium text-gray-500">{project.location.city}</p>
              <h3 className="mt-1 text-lg font-semibold text-gray-900 group-hover:text-teal-800">
                {project.name}
              </h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-gray-600">{project.summary}</p>

              {/* Only when a stage is actually verified. Absent is the norm. */}
              {project.currentStage && (
                <p className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-teal-600" aria-hidden="true" />
                  {tStages(project.currentStage)}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </Section>
  )
}

/**
 * Branded placeholder, used because no verified project photography exists.
 *
 * A deliberate graphic rather than a stock building: a photograph of an
 * unrelated block placed under a named project asserts that the picture IS that
 * project. This is visibly a mark, not a photo, so it makes no claim at all.
 *
 * The doorway motif repeats the hero's, so the placeholder reads as the brand
 * rather than as a missing image.
 */
function ProjectPlaceholder({ name }: { name: string }) {
  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden bg-surface-sunken">
      <svg
        viewBox="0 0 320 200"
        className="h-full w-full"
        role="img"
        aria-label={`סימן גרפי — ${name}`}
        fill="none"
      >
        <path d="M0 170h320" stroke="#d5d8db" strokeWidth="1.25" />
        <path d="M92 170V70h60v100" stroke="#b8bdc2" strokeWidth="1.5" />
        <path d="M168 170V96h60v74" stroke="#d5d8db" strokeWidth="1.5" />
        {[96, 122, 148].map((y) => (
          <path key={y} d={`M92 ${y}h60`} stroke="#eaecee" strokeWidth="1" />
        ))}
        {[122, 148].map((y) => (
          <path key={`b-${y}`} d={`M168 ${y}h60`} stroke="#eaecee" strokeWidth="1" />
        ))}
        <path d="M112 170v-38h22v38" stroke="#2F9DA0" strokeWidth="2" strokeLinejoin="round" />
        <path d="M92 70h60" stroke="#2F9DA0" strokeWidth="2" />
      </svg>
    </div>
  )
}
