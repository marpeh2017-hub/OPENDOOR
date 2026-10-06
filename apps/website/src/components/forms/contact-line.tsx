import { CONTACT } from '@/lib/site-config'
import { LineIcon } from '@/components/brand/line-icon'

/**
 * The company's phone and email as two tappable links, with a short lead-in.
 *
 * ── WHY A FORM PAGE CARRIES IT ─────────────────────────────────────────────
 *
 * Some owners would rather call than type, and a form that cannot send (the
 * network, a server that is down) must not be the end of the road. So the
 * enquiry page shows this line under its heading, and a failed submission
 * shows it again under the retry button: either way the visitor leaves with
 * a number to call.
 *
 * Plain markup and site-config only, so it renders in server and client
 * components alike. The numbers read left to right inside Hebrew text.
 */
export function ContactLine({
  label,
  tone = 'default',
  className = '',
}: {
  label: string
  /** `alert`: inside the red failure notice, where teal would clash. */
  tone?: 'default' | 'alert'
  className?: string
}) {
  const link =
    tone === 'alert'
      ? 'text-red-900 underline underline-offset-4 hover:text-red-950'
      : 'text-teal-600 hover:text-teal-700'

  return (
    <div className={`flex flex-wrap items-center gap-x-5 gap-y-1 ${className}`}>
      <span className={tone === 'alert' ? 'type-small text-red-800' : 'type-body text-gray-700'}>{label}</span>
      <a
        href={CONTACT.phoneHref}
        dir="ltr"
        className={`inline-flex min-h-11 items-center gap-2 type-body font-semibold ${link}`}
      >
        <LineIcon name="phone" size={20} />
        {CONTACT.phone}
      </a>
      <a
        href={`mailto:${CONTACT.email}`}
        dir="ltr"
        className={`inline-flex min-h-11 items-center gap-2 type-body font-semibold ${link}`}
      >
        <LineIcon name="mail" size={20} />
        {CONTACT.email}
      </a>
    </div>
  )
}
