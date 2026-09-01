import type { PublicProject } from '@urban-renewal/api-contracts'
import { getTranslations } from 'next-intl/server'
import { ProjectPattern } from '@/components/brand/architecture'
import { heroPhoto } from '@/lib/project-presentation'

/**
 * The band under the project's name.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  ONLY A VERIFIED PROJECT PHOTOGRAPH MAY OPEN A PROJECT PAGE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `heroPhoto` returns null for anything that is not a
 * `VERIFIED_PROJECT_PHOTO`. An `EDITORIAL_CONTEXT` image at hero scale, sitting
 * directly beneath this project's name and address, IS the assertion that it
 * depicts the project — whatever its caption says, because the caption is read
 * second and by fewer people. There is no caption wording that undoes a
 * full-bleed photograph in that position.
 *
 * ── THE FALLBACK IS NOT A SMALLER VERSION OF THE PHOTO SLOT ────────────────
 *
 * When there is no photograph the pattern takes the SAME band height a
 * photograph would have had, and the drawing is scaled up to fill it rather
 * than being centred small inside a large grey box. A small mark in a big
 * empty frame reads as a missing asset; a large drawing reads as a drawing.
 *
 * The page must feel complete with the pattern alone, because for every real
 * project that is the state it launches in.
 *
 * The one line beneath the fallback says what the drawing is. It is not an
 * apology and not an image credit: it exists so nobody reads a schematic as a
 * rendering of the finished building.
 */
export async function ProjectHero({ project }: { project: PublicProject }) {
  const t = await getTranslations('projectImages')
  const photo = heroPhoto(project)

  if (photo) {
    return (
      <div className="relative aspect-[21/9] overflow-hidden bg-surface-sunken sm:aspect-[21/8]">
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
        <div className="absolute bottom-0 start-0 flex flex-wrap items-center gap-x-2.5 gap-y-1 bg-surface-inverse/90 px-4 py-2.5 text-white">
          <span className="text-[12.5px] font-semibold">{t('projectPhoto')}</span>
          {(photo.takenOn || photo.credit) && (
            <span className="text-[12.5px] text-gray-300">
              {[photo.takenOn, photo.credit].filter(Boolean).join(' · ')}
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="aspect-[21/9] overflow-hidden bg-surface-sunken sm:aspect-[21/8]">
        <ProjectPattern slug={project.slug} />
      </div>
      <p className="mx-auto mt-4 max-w-7xl px-4 text-[13px] text-gray-600 lg:px-8">
        {t('patternCaption')}
      </p>
    </>
  )
}
