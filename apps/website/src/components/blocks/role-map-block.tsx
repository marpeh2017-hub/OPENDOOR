import type { RoleMapBlock, RoleNode } from '@urban-renewal/api-contracts'
import { Section, SectionHeading } from './section'
import type { Localizer } from '@/lib/localize'
import { STROKE } from '@/components/brand/architecture'

/**
 * Who is who in the process.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  RELATIONSHIPS, NOT HIERARCHY
 * ══════════════════════════════════════════════════════════════════════════
 *
 * The instinctive way to draw this is an org chart: OpenDoor at the top with
 * lines running down to the lawyer, the appraiser, the architect and the
 * developer. That drawing would be false. OpenDoor does not employ, instruct
 * or supervise any of them — they are appointed by the owners and remain
 * professionally responsible for their own work.
 *
 * So there are no arrows and no branching lines anywhere in this component.
 * What it draws instead is a TABLE with two sides: the owners and their
 * representation above it, OpenDoor on the line itself, and the other parties
 * below as peers of one another. Position states who sits where. Nothing
 * states who directs whom, because nobody does.
 *
 * ── THE INDEPENDENCE NOTE IS REQUIRED BY THE TYPE ──────────────────────────
 *
 * `independenceNote` is not optional on `RoleMapBlock`. A diagram showing an
 * organising company beside a lawyer and an appraiser invites exactly one
 * misreading — that the organiser can stand in for them — and the correction
 * has to sit next to the diagram rather than in a policy page nobody opens.
 *
 * ── NO HOVER-GATED CONTENT ─────────────────────────────────────────────────
 *
 * Every role's explanation is permanently visible. An earlier version of this
 * idea revealed the detail on hover, which put the substance of the section
 * behind a gesture that does not exist on a phone and would have required
 * `tabindex` on non-interactive text to reach by keyboard. The explanations
 * ARE the section; hiding them would make it decorative.
 */
export function RoleMapBlockView({ block, t }: { block: RoleMapBlock; t: Localizer }) {
  return (
    <Section size="lg">
      {(block.heading || block.intro) && (
        <SectionHeading heading={block.heading} intro={block.intro} t={t} size="lg" />
      )}

      <div className="mt-12">
        {/* ── the owners' side ──────────────────────────────────────────── */}
        <ul className="grid gap-5 sm:grid-cols-2">
          {block.ownersSide.map((node) => (
            <li key={node.id} className="relative bg-white p-6">
              <span
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-0.5"
                style={{ background: STROKE.tealDeep }}
              />
              <h3 className="text-base font-semibold text-gray-900">{t(node.label)}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-gray-600">{t(node.detail)}</p>
            </li>
          ))}
        </ul>

        {/* ── the table: a line with an opening in the middle ─────────────
            The same interrupted-border motif the rest of the site uses, here
            reading as two sides of a table with a threshold between them. */}
        <div aria-hidden="true" className="relative my-6 h-8">
          <span
            className="absolute start-0 top-1/2 h-px w-[calc(50%-1.5rem)]"
            style={{ background: STROKE.faint }}
          />
          <span
            className="absolute end-0 top-1/2 h-px w-[calc(50%-1.5rem)]"
            style={{ background: STROKE.faint }}
          />
          <span
            className="absolute start-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45"
            style={{ background: STROKE.teal }}
          />
        </div>

        {/* ── the organiser, on the line ────────────────────────────────── */}
        <div className="relative bg-white p-6 sm:p-7">
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-[3px]"
            style={{ background: STROKE.teal }}
          />
          <h3 className="text-base font-semibold text-gray-900 sm:text-lg">
            {t(block.organiser.label)}
          </h3>
          <p className="mt-2.5 max-w-3xl text-sm leading-relaxed text-gray-600 sm:text-[15px]">
            {t(block.organiser.detail)}
          </p>
        </div>

        {/* ── the other parties, as peers ───────────────────────────────── */}
        <ul className="mt-10 grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
          {block.parties.map((node) => (
            <PartyEntry key={node.id} node={node} t={t} />
          ))}
        </ul>

        {/* ── the correction, beside the diagram ────────────────────────── */}
        <p className="mt-10 max-w-3xl border-s-2 border-teal-300 ps-5 text-[15px] leading-relaxed text-gray-700">
          {t(block.independenceNote)}
        </p>
      </div>
    </Section>
  )
}

/**
 * One party.
 *
 * A hairline above rather than a border around: a box would make each party
 * look like a discrete unit of the same kind as the organiser's panel, and
 * these are references in an explanation, not equivalent entities.
 */
function PartyEntry({ node, t }: { node: RoleNode; t: Localizer }) {
  return (
    <li>
      <span aria-hidden="true" className="block h-px w-full bg-gray-300" />
      <h3 className="mt-4 text-[15px] font-semibold text-gray-900">{t(node.label)}</h3>
      <p className="mt-2 text-sm leading-relaxed text-gray-600">{t(node.detail)}</p>
    </li>
  )
}
