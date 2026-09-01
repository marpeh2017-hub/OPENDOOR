import type { PublicProject } from '@urban-renewal/api-contracts'
import { getTranslations } from 'next-intl/server'
import type { Localizer } from '@/lib/localize'
import { Section } from '@/components/blocks/section'
import { ProjectHero } from './project-hero'
import { StageRail } from './stage-rail'
import { FactTable } from './fact-table'
import { VerificationNote } from './verification-note'
import { MilestoneList } from './milestone-list'
import { GalleryGrid } from './gallery-grid'
import { ResidentBridge } from './resident-bridge'
import { STROKE } from '@/components/brand/architecture'
import {
  galleryItems, hasProjectFacts, oldestVerification,
} from '@/lib/project-presentation'

/**
 * The project detail page's entire body.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  THE SECTION ORDER IS THE RESIDENT'S QUESTION ORDER
 * ══════════════════════════════════════════════════════════════════════════
 *
 *   1. Where is this project?          identity header
 *   2. What is OpenDoor's role?        the inverse band
 *   3. Where does the process stand?   the phase rail
 *   4. What has happened so far?       the milestone list
 *   5. What comes next?                the same list, upcoming entries
 *   6. What is verified?               facts, with one verification note
 *   7. What can residents reach?       the bridge
 *   8. How does an owner continue?     the bridge's actions
 *
 * ROLE COMES BEFORE ANY NUMBER, deliberately. A page that opens with unit
 * counts is a sales sheet for the development; a page that opens by saying
 * whose side we are on is a page about representation. The counts sit further
 * down, under a heading, beside their verification note.
 *
 * ── EVERY SECTION IS CONDITIONAL, AND SILENCE IS THE DEFAULT ───────────
 *
 * There is no `else` anywhere below. An absent stage means no rail; absent
 * facts mean no facts section; an absent gallery means no gallery heading.
 * Nothing prints a per-field "not published" notice: the brief forbids them,
 * and a page repeating one six times reads as abandoned rather than careful.
 *
 * The ONE explained absence is the whole-project case: when a project has no
 * verified facts at all, a single paragraph says so and points at the process
 * explanation. That is the situation where the absence is itself material to
 * understanding the project, which is exactly the test the brief sets.
 *
 * ── WHY THIS IS A COMPONENT AND NOT THE ROUTE ─────────────────────────
 *
 * The development preview route renders the SAME body. A preview that
 * reimplemented the layout would be testing the preview rather than the page,
 * which is the usual way such a route stops being evidence of anything.
 *
 * ── THE ROLE COPY IS FIXED, NOT PER-PROJECT ───────────────────────────
 *
 * It is read from the message catalogue rather than from the project record.
 * OpenDoor's role does not vary by complex, and making it editable per project
 * would invite a version that quietly claims more on one page than the company
 * can defend on all of them.
 */
export async function ProjectBody({
  project,
  locale,
  t,
}: {
  project: PublicProject
  locale: string
  t: Localizer
}) {
  const [tRole, tSections, tFacts] = await Promise.all([
    getTranslations('projectRole'),
    getTranslations('projectSections'),
    getTranslations('projectFacts'),
  ])

  const facts = hasProjectFacts(project)
  const verifiedAt = oldestVerification(project)
  const gallery = galleryItems(project)
  const milestones = project.milestones ?? []

  const place = [project.location.city, project.location.neighborhood].filter(Boolean)

  return (
    <>
    {/* ── 1. WHERE IS THIS PROJECT? ─────────────────────────────────── */}
    <div className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 pb-10 pt-8 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-end lg:gap-14">
          <div>
            {/* Only when the track is confirmed. An unconfirmed one is absent
                rather than shown as "Other route", which would read as a
                classification somebody made. */}
            {project.type && (
              <div className="text-xs font-bold tracking-[0.14em] text-teal-700">
                {tFacts(`type.${project.type}`)}
              </div>
            )}
            <h1 className={`${project.type ? 'mt-3.5' : ''} text-4xl font-extrabold leading-[1.06] tracking-tight text-gray-900 sm:text-5xl`}>
              {project.name}
            </h1>
            <span aria-hidden="true" className="mt-5 block h-0.5 w-14 bg-teal-600" />

            {/* Only the identity fields that exist. No empty label rows. */}
            {(place.length > 0 || project.location.street) && (
              <dl className="mt-6 flex flex-wrap gap-x-7 gap-y-2 text-[15px]">
                {place.map((value, index) => (
                  <div key={value} className="flex gap-2">
                    <dt className="text-gray-600">
                      {tFacts(index === 0 ? 'city' : 'neighborhood')}
                    </dt>
                    <dd className="m-0 font-semibold text-gray-800">{value}</dd>
                  </div>
                ))}
                {project.location.street && (
                  <div className="flex gap-2">
                    <dt className="text-gray-600">{tFacts('address')}</dt>
                    <dd className="m-0 font-semibold text-gray-800">
                      {project.location.street}
                    </dd>
                  </div>
                )}
              </dl>
            )}
          </div>

          <p className="text-base leading-relaxed text-gray-600 sm:text-[17px]">
            {project.summary}
          </p>
        </div>
      </div>
    </div>

    <ProjectHero project={project} />

    {/* ── 2. WHAT IS OPENDOOR'S ROLE? ───────────────────────────────── */}
    <Section tone="inverse" size="lg">
      <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16">
        <div>
          <div className="text-xs font-bold tracking-[0.14em] text-teal-400">
            {tRole('eyebrow')}
          </div>
          <h2 className="mt-4 max-w-[17ch] text-2xl font-bold leading-tight tracking-tight text-white sm:text-3xl">
            {tRole('heading')}
          </h2>
          <span aria-hidden="true" className="mt-5 block h-0.5 w-14 bg-teal-400" />
        </div>
        {/* A project may override the role description; when it does not, the
            reviewed site-level wording renders. Either way the value is
            editable, and neither path is hardcoded in this component. */}
        <div>
          {project.role ? (
            <p className="text-base leading-relaxed text-gray-300 sm:text-[17px]">
              {t(project.role)}
            </p>
          ) : (
            <>
              <p className="text-base leading-relaxed text-gray-300 sm:text-[17px]">
                {tRole('body1')}
              </p>
              <p className="mt-4 text-base leading-relaxed text-gray-300 sm:text-[17px]">
                {tRole('body2')}
              </p>
            </>
          )}
        </div>
      </div>
    </Section>

    {/* ── THE PROJECT'S OWN OVERVIEW ────────────────────────────────────
        `summary` is the one sentence that rides on cards and in the header;
        `description` is the fuller account, and it is the field an editor
        reaches for when there is something to say about a complex that is not
        a number. On a sparse project it is most of the page, which is why it
        renders before the sections that may be absent.

        Split on newlines and NEVER parsed as markup: this is editor-supplied
        content, and a renderer that interprets it is an injection surface. */}
    {project.description && (
      <Section size="lg">
        <div className="max-w-prose">
          {project.description.split('\n').filter(Boolean).map((paragraph, index) => (
            <p
              key={index}
              className={`text-base leading-relaxed text-gray-600 sm:text-[17px] ${
                index > 0 ? 'mt-5' : ''
              }`}
            >
              {paragraph}
            </p>
          ))}
        </div>
      </Section>
    )}

    {/* ── 3. WHERE DOES THE PROCESS STAND? ──────────────────────────────
        Absent when NEITHER a stage nor a phase is verified, which is the
        state a brand new project record is in. There is no default to the
        first phase: that would state, in a graphic, that the project is at
        the beginning — a factual claim nobody checked. */}
    {(project.currentStage || project.currentPhase) && (
      <Section size="lg">
        <SectionHead
          eyebrow={tSections('stageEyebrow')}
          heading={tSections('stageHeading')}
          intro={tSections('stageIntro')}
        />
        {/* Stage wins when present, so a derived phase and an explicitly
            published one can never contradict each other on screen. */}
        <StageRail
          {...(project.currentStage
            ? { currentStage: project.currentStage.value }
            : { currentPhase: project.currentPhase!.value })}
        />
      </Section>
    )}

    {/* ── 4 + 5. WHAT HAS HAPPENED, AND WHAT COMES NEXT ─────────────── */}
    {milestones.length > 0 && (
      <Section tone="raised" size="lg">
        <SectionHead
          eyebrow={tSections('timelineEyebrow')}
          heading={tSections('timelineHeading')}
          intro={tSections('timelineIntro')}
        />
        {/* This project's own note about why its sequence is not tidy, when
            the generic line above is not enough. */}
        {project.timelineNote && (
          <p className="mt-4 max-w-prose text-[15px] leading-relaxed text-gray-600">
            {t(project.timelineNote)}
          </p>
        )}
        <MilestoneList milestones={milestones} t={t} />
      </Section>
    )}

    {/* ── 6. WHAT VERIFIED INFORMATION IS AVAILABLE? ────────────────── */}
    {facts ? (
      <Section size="lg">
        <SectionHead
          eyebrow={tSections('factsEyebrow')}
          heading={tSections('factsHeading')}
        />
        <div className="mt-10 grid gap-12 lg:grid-cols-[1.35fr_0.65fr] lg:items-start lg:gap-14">
          <FactTable project={project} t={t} />
          {verifiedAt && <VerificationNote verifiedAt={verifiedAt} locale={locale} />}
        </div>
      </Section>
    ) : (
      /* The one place an absence is explained, because here it IS material:
         a reader looking for numbers needs to know none are published rather
         than assume the page failed to load. One paragraph, not six. */
      <Section size="lg">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start lg:gap-16">
          <div>
            <div className="text-xs font-bold tracking-[0.14em] text-teal-700">
              {tSections('noFactsEyebrow')}
            </div>
            <h2 className="mt-3 max-w-[18ch] text-2xl font-bold leading-tight tracking-tight text-gray-900 sm:text-3xl">
              {tSections('noFactsHeading')}
            </h2>
            <span aria-hidden="true" className="mt-5 block h-0.5 w-14 bg-teal-600" />
          </div>
          <div>
            <p className="text-base leading-relaxed text-gray-600 sm:text-[17px]">
              {tSections('noFactsBody1')}
            </p>
            <p className="mt-4 text-base leading-relaxed text-gray-600 sm:text-[17px]">
              {tSections('noFactsBody2')}
            </p>
          </div>
        </div>
      </Section>
    )}

    {/* ── GALLERY ───────────────────────────────────────────────────────
        Absent, not empty. No "no images yet" box: the generated pattern
        already carries the hero, and a second empty frame would only draw
        attention to what is missing. */}
    {gallery.length > 0 && (
      <Section tone="raised" size="lg">
        <SectionHead
          eyebrow={tSections('galleryEyebrow')}
          heading={tSections('galleryHeading')}
        />
        <GalleryGrid items={gallery} />
      </Section>
    )}

    {/* ── 7 + 8. WHAT CAN RESIDENTS REACH, AND HOW TO CONTINUE ──────── */}
    <Section size="lg">
      <ResidentBridge />
    </Section>
  </>
  )
}

/** The page's one heading shape, so seven sections cannot drift apart. */
function SectionHead({
  eyebrow,
  heading,
  intro,
}: {
  eyebrow: string
  heading: string
  intro?: string
}) {
  return (
    <div>
      <div className="text-xs font-bold tracking-[0.14em] text-teal-700">{eyebrow}</div>
      <h2 className="mt-3 text-2xl font-bold leading-tight tracking-tight text-gray-900 sm:text-3xl">
        {heading}
      </h2>
      <span
        aria-hidden="true"
        className="mt-5 block h-0.5 w-14"
        style={{ background: STROKE.tealDeep }}
      />
      {intro && (
        <p className="mt-6 max-w-prose text-base leading-relaxed text-gray-600">{intro}</p>
      )}
    </div>
  )
}
