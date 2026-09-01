import type { PublicProject } from '@urban-renewal/api-contracts'
import { getTranslations } from 'next-intl/server'
import type { Localizer } from '@/lib/localize'
import { VolatilityNote } from './verification-note'

/**
 * The verified facts, as a reading table.
 *
 * ── WHY THE COUNTS SIT ABOVE THE ROWS, NOT AMONG THEM ──────────────────────
 *
 * Unit and building counts are the only fields here that a reader scans rather
 * than reads. Given their own band at display size they answer the scanning
 * question immediately; mixed into the label/value rows they would force the
 * reader to hunt for them AND make the rows look like a specification sheet.
 *
 * ── ABSENT FIELDS LEAVE NO TRACE ───────────────────────────────────────────
 *
 * Every row below is conditional, and there is no `else`. No empty cell, no
 * dash, no "not published", no greyed-out label. The brief is explicit: an
 * absent field is not rendered, and the page must look intentionally designed
 * rather than incomplete. A row of "טרם פורסם" repeated six times is the
 * clearest possible way to make a project look abandoned.
 *
 * The one exception is explanatory, not per-field: when a project has NO facts
 * at all, the caller renders a single paragraph instead of this table. That is
 * the case where the absence is itself material to understanding the project.
 */
export async function FactTable({
  project,
  t: loc,
}: {
  project: PublicProject
  /** Resolves `LocalizedText` on approvals, permits and dated records. Passed
   *  in rather than read here so this stays a server component with no locale
   *  awareness of its own, as everywhere else on the site. */
  t: Localizer
}) {
  const [t, tTypes, tPlanning] = await Promise.all([
    getTranslations('projectFacts'),
    getTranslations('projectTypes'),
    getTranslations('planningStatus'),
  ])

  const counts = [
    project.existingUnits ? { key: 'existingUnits', value: project.existingUnits.value } : null,
    project.proposedUnits ? { key: 'proposedUnits', value: project.proposedUnits.value } : null,
    project.buildingCount ? { key: 'buildingCount', value: project.buildingCount.value } : null,
  ].filter((entry): entry is { key: string; value: number } => entry !== null)

  return (
    <div>
      {counts.length > 0 && (
        <dl
          className="grid border-t border-gray-300 sm:grid-cols-2 lg:grid-cols-3"
          // Columns match the number present, so two counts do not sit in a
          // three-column grid with a visible hole where the third would be.
          style={{ gridTemplateColumns: `repeat(${Math.min(counts.length, 3)}, minmax(0, 1fr))` }}
        >
          {counts.map((entry, index) => (
            <div
              key={entry.key}
              className={`py-6 ${index > 0 ? 'border-s border-gray-200 ps-7' : ''}`}
            >
              <dt className="text-[13px] text-gray-600">{t(entry.key)}</dt>
              <dd className="mt-2 text-3xl font-extrabold tracking-tight tabular-nums text-gray-900 sm:text-[2.125rem]">
                {entry.value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <dl className="border-t border-gray-200">
        {project.type && <Row label={t('track')}>{tTypes(project.type)}</Row>}

        {project.planningStatus && (
          <Row label={t('planningStatus')}>
            <span className="font-semibold text-gray-800">
              {tPlanning(project.planningStatus.value)}
            </span>
            <VolatilityNote kind="planning" />
          </Row>
        )}

        {project.approvals && project.approvals.value.length > 0 && (
          <Row label={t('approvals')}>
            <ul className="space-y-1.5">
              {project.approvals.value.map((approval) => (
                <li key={approval.id} className="leading-relaxed">
                  {loc(approval.label)}
                  {approval.authority && (
                    <span className="text-gray-600"> · {approval.authority}</span>
                  )}
                  {approval.reference && (
                    <span className="text-gray-600"> · {approval.reference}</span>
                  )}
                </li>
              ))}
            </ul>
            <VolatilityNote kind="approvals" />
          </Row>
        )}

        {project.permits && project.permits.value.length > 0 && (
          <Row label={t('permits')}>
            <ul className="space-y-1.5">
              {project.permits.value.map((permit) => (
                <li key={permit.id} className="leading-relaxed">
                  {loc(permit.label)}
                  {permit.authority && (
                    <span className="text-gray-600"> · {permit.authority}</span>
                  )}
                </li>
              ))}
            </ul>
            <VolatilityNote kind="approvals" />
          </Row>
        )}

        {/* A named commercial party. The clarification underneath is not
            optional politeness: without it, listing the developer on OpenDoor's
            page implies a relationship that does not exist, and implies the
            developer is on the owners' side of the table. */}
        {project.developer && (
          <Row label={t('developer')}>
            <span className="font-semibold text-gray-800">{project.developer.value.name}</span>
            <span className="mt-1.5 block text-[13px] leading-relaxed text-gray-600">
              {t('developerNote')}
            </span>
          </Row>
        )}

        {project.materialDates && project.materialDates.value.length > 0 && (
          <Row label={t('dates')}>
            <ul className="space-y-1.5">
              {project.materialDates.value.map((record) => (
                <li key={record.id} className="leading-relaxed">
                  {loc(record.label)}
                  <span className="text-gray-600">
                    {' · '}
                    {record.occursOn}
                    {/* An estimate shown as a commitment is how a timeline
                        becomes a broken promise. The type carries the flag; the
                        renderer is required to honour it. */}
                    {record.isEstimate && ` (${t('estimate')})`}
                  </span>
                </li>
              ))}
            </ul>
          </Row>
        )}
      </dl>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-3 border-b border-gray-200 py-5 sm:grid-cols-[190px_1fr] sm:gap-6">
      <dt className="text-sm text-gray-600">{label}</dt>
      <dd className="m-0 text-[15px] text-gray-800">{children}</dd>
    </div>
  )
}
