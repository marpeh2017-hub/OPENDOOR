import type { PublicProjectSummary } from '@urban-renewal/api-contracts'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { ProjectPattern, STROKE } from '@/components/brand/architecture'

/**
 * One project, on the index.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  THE CARD IS BUILT FOR ITS POOREST STATE, NOT ITS RICHEST
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Guaranteed: a name, a city, one sentence. Everything else — photograph,
 * verified stage, neighbourhood — is optional and usually absent.
 *
 * So the card's structure carries the weight and the data decorates it: the
 * interrupted teal rule at the head of the content block, the generated mark
 * above it, the measured type. Strip every optional field and what remains
 * still reads as a finished object rather than as a card that failed to load.
 * That is the inverse of the usual approach, where a card is designed full and
 * then degrades.
 *
 * ── WHY THERE IS NO BUTTON ─────────────────────────────────────────────────
 *
 * The whole card is one link. A card with a "View project" button, a price-like
 * figure and a photograph is the visual grammar of a property listing, which is
 * the exact thing this must not be. One link, no call to action, no badge row.
 *
 * ── WHY NO UNIT COUNTS BY DEFAULT ──────────────────────────────────────────
 *
 * `PublicProjectSummary` deliberately does not carry them. A grid of large
 * numbers turns a portfolio of representation work into a catalogue of
 * inventory, and the numbers are the developer's story rather than the owners'.
 * They belong on the detail page, under a heading, with their verification
 * note beside them.
 *
 * ── THE HEADING LEVEL IS THE CALLER'S ────────────────────────────────────
 *
 * On an index page the cards sit directly under the page `h1` with no section
 * heading between, so they are `h2`. Under a homepage section that has its own
 * `h2` they would be `h3`. Hardcoding either skips a level in the other
 * context, which is exactly the defect this prop removes rather than papering
 * over: `h2` is the default because the index is the primary use.
 */
export async function ProjectCard({
  project,
  headingLevel: Heading = 'h2',
}: {
  project: PublicProjectSummary
  headingLevel?: 'h2' | 'h3'
}) {
  const [tStages, tImages] = await Promise.all([
    getTranslations('stages'),
    getTranslations('projectImages'),
  ])

  // Only a verified project photograph may sit on a card. An EDITORIAL_CONTEXT
  // image under a project's name is read as a picture OF that project, whatever
  // the caption underneath says.
  const photo =
    project.heroImage?.kind === 'image' &&
    project.heroImage.imageType === 'VERIFIED_PROJECT_PHOTO'
      ? project.heroImage
      : null

  const place = [project.location.city, project.location.neighborhood]
    .filter(Boolean)
    .join(' · ')

  return (
    <li className="h-full">
      <Link
        href={`/projects/${project.slug}`}
        className="group flex h-full flex-col border border-gray-200 bg-white transition-colors hover:border-teal-300"
      >
        <div className="relative aspect-[16/10] overflow-hidden bg-surface-sunken">
          {photo ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={photo.alt}
                className="h-full w-full object-cover"
                style={
                  photo.focalPoint
                    ? { objectPosition: `${photo.focalPoint.x}% ${photo.focalPoint.y}%` }
                    : undefined
                }
              />
              {/* The claim, stated on the image rather than under it. A label
                  that scrolls away from its picture stops labelling it. */}
              <span className="absolute bottom-0 start-0 bg-surface-inverse/90 px-2.5 py-1.5 text-[11px] font-medium text-white">
                {tImages('projectPhoto')}
              </span>
            </>
          ) : (
            // The fallback is not a placeholder: it is a drawing, generated
            // from the slug so no two projects share a mark, and it asserts
            // nothing about the building.
            <ProjectPattern slug={project.slug} />
          )}
        </div>

        <div className="relative flex flex-grow flex-col p-5 sm:p-6">
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-0.5 w-[34%]"
            style={{ background: STROKE.teal }}
          />

          <Heading className="text-lg font-bold tracking-tight text-gray-900 transition-colors group-hover:text-teal-800 sm:text-xl">
            {project.name}
          </Heading>

          {place && <p className="mt-1.5 text-[13px] text-gray-600">{place}</p>}

          <p className="mt-3.5 text-sm leading-relaxed text-gray-600">{project.summary}</p>

          {/* Absent for most projects, and the card is spaced to look correct
              without it rather than leaving a reserved gap. */}
          {project.currentStage && (
            <div className="mt-auto pt-5">
              <span className="inline-flex items-center gap-2 border border-teal-300 px-2.5 py-1.5 text-xs font-semibold text-teal-700">
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: STROKE.teal }}
                />
                {tStages(project.currentStage.value)}
              </span>
            </div>
          )}
        </div>
      </Link>
    </li>
  )
}
