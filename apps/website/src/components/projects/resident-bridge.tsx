import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { STROKE } from '@/components/brand/architecture'
import { RESIDENT_ACCESS } from '@/lib/project-presentation'

/**
 * The bridge to the private environment for apartment owners.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  IT MUST NOT PROMISE A DOOR THAT DOES NOT OPEN
 * ══════════════════════════════════════════════════════════════════════════
 *
 * An owner reaching this page wants to know why their apartment's documents
 * are not on it. The honest answer is that the public page carries general
 * information and their material is delivered elsewhere. That answer is useful
 * whether or not a private environment exists yet.
 *
 * What must never happen is a sign-in control that leads nowhere. So this
 * reads `RESIDENT_ACCESS` and renders one of three things:
 *
 *   AVAILABLE   a sign-in link out to the portal.
 *   COMING_SOON no sign-in at all. It states what exists TODAY — meetings,
 *               written summaries, direct contact with the representation —
 *               and offers contact instead. This is the current state.
 *   HIDDEN      nothing, for a representation that has asked that no resident
 *               channel be advertised publicly.
 *
 * ── NO AUTHENTICATION, AND NOTHING PRIVATE ─────────────────────────────────
 *
 * There is no form, no email field, no apartment number, no access code. The
 * bridge is a link and an explanation.
 *
 * The two lists below name CATEGORIES of material, never this project's actual
 * private content: no document names, and no counts. A count is a disclosure —
 * "14 documents" tells a reader something about the project's state that
 * nobody agreed to publish.
 */
export async function ResidentBridge() {
  if (RESIDENT_ACCESS === 'HIDDEN') return null

  const [t, tLinks] = await Promise.all([
    getTranslations('residentBridge'),
    getTranslations('links'),
  ])

  const available = RESIDENT_ACCESS === 'AVAILABLE'

  return (
    <div className="relative bg-white px-6 py-11 sm:px-11 sm:py-12">
      {/* The door at its largest on the page: head interrupted, sill solid. */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-0">
        <span className="absolute start-0 top-0 h-px w-[18%]" style={{ background: STROKE.teal }} />
        <span className="absolute end-0 top-0 h-px w-[52%]" style={{ background: STROKE.teal }} />
        <span
          className="absolute bottom-0 start-0 h-0.5 w-full"
          style={{ background: STROKE.teal }}
        />
        <span
          className="absolute bottom-0 start-0 top-0 w-px"
          style={{ background: STROKE.teal }}
        />
        <span className="absolute bottom-0 end-0 top-0 w-px" style={{ background: STROKE.teal }} />
      </span>

      <div className="relative grid gap-11 lg:grid-cols-2 lg:gap-14">
        <div>
          <h2 className="text-2xl font-bold leading-tight tracking-tight text-gray-900 sm:text-[28px]">
            {t('heading')}
          </h2>
          <span aria-hidden="true" className="mt-5 block h-0.5 w-14 bg-teal-600" />
          <p className="mt-5 max-w-prose text-base leading-relaxed text-gray-600">{t('body')}</p>
          {!available && (
            <p className="mt-4 max-w-prose text-base leading-relaxed text-gray-600">
              {t('comingSoon')}
            </p>
          )}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {available ? (
              <Link
                href="/resident-portal"
                className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-teal-600 px-6 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-teal-700"
              >
                {t('signIn')}
              </Link>
            ) : (
              <Link
                href="/resident-portal"
                className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-gray-400 bg-white px-6 py-3.5 text-[15px] font-semibold text-gray-800 transition-colors hover:border-teal-600 hover:text-teal-800"
              >
                {t('about')}
              </Link>
            )}
            <Link
              href="/contact"
              className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-gray-400 bg-white px-6 py-3.5 text-[15px] font-semibold text-gray-800 transition-colors hover:border-teal-600 hover:text-teal-800"
            >
              {tLinks('contact')}
            </Link>
          </div>
        </div>

        <div className="bg-surface-sunken p-6 sm:p-7">
          <div className="text-xs font-bold tracking-widest text-gray-600">{t('whatIsWhere')}</div>
          <div className="mt-5 grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="text-sm font-bold text-gray-900">{t('publicHeading')}</h3>
              <ul className="mt-2.5 list-disc space-y-1.5 ps-4 text-[13px] leading-relaxed text-gray-600">
                <li>{t('public1')}</li>
                <li>{t('public2')}</li>
                <li>{t('public3')}</li>
                <li>{t('public4')}</li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">{t('privateHeading')}</h3>
              <ul className="mt-2.5 list-disc space-y-1.5 ps-4 text-[13px] leading-relaxed text-gray-600">
                <li>{t('private1')}</li>
                <li>{t('private2')}</li>
                <li>{t('private3')}</li>
                <li>{t('private4')}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
