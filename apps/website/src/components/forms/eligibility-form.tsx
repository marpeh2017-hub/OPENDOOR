'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import {
  Field, FieldLabel, FieldDescription, FieldError,
  Input, Textarea, Checkbox, RadioGroup, Button,
} from '@urban-renewal/ui'
import type { EligibilitySubmission, Locale, OrganizingStatusAnswer } from '@urban-renewal/api-contracts'
import { Link } from '@/i18n/navigation'
import { buildSubmissionMetadata, getLeadSubmissionService } from '@/lib/submission'
import {
  isPresent, isValidApartmentCount, isValidEmail, isValidPhone, normalisePhone,
} from '@/lib/validation'
import {
  ErrorSummary, OptionalDivider, SubmissionFailureNotice, SubmissionSuccess,
} from './form-parts'

/**
 * The eligibility check: the site's primary conversion.
 *
 * ── ONE COMPACT FORM, NOT A WIZARD ─────────────────────────────────────────
 *
 * Three required fields. A multi-step flow for three fields costs a click, a
 * second render, ambiguous back-button behaviour and state to carry between
 * screens, and buys nothing — the only real argument for it was capturing a
 * partial lead, which would need a submission at step one and therefore either
 * two writes or a draft record. The CRM is the single system of record, so
 * neither is acceptable.
 *
 * `OptionalDivider` does the work a step counter would have: it tells the
 * visitor the required part is behind them.
 *
 * ── VALIDATION TIMING ──────────────────────────────────────────────────────
 *
 * Nothing validates until a submit is attempted. After that, a field that has
 * already failed re-validates as it changes, so a correction clears its error
 * immediately. Validating from the first keystroke tells someone their phone
 * number is wrong after three digits, which is true and useless.
 *
 * ── NOTHING IS EVER FAKED ──────────────────────────────────────────────────
 *
 * `submitted` flips to true only when the adapter returns `ok: true`. The
 * development adapter never does. The success screen is unreachable until a
 * real endpoint genuinely accepts a submission, which is the property that
 * stops a mock-wired form reaching production unnoticed.
 */

type FieldName = 'address' | 'fullName' | 'phone' | 'email' | 'apartments' | 'notes' | 'consent'

const ORGANIZING_OPTIONS: OrganizingStatusAnswer[] = [
  'NOT_STARTED', 'EARLY_CONVERSATION', 'REPRESENTATION_FORMED', 'PROCESS_ACTIVE',
]

export function EligibilityForm() {
  const locale = useLocale() as Locale
  const t = useTranslations('eligibility')
  const tForms = useTranslations('forms')
  const tErrors = useTranslations('forms.errors')
  const tOrg = useTranslations('eligibility.org')
  const tLinks = useTranslations('links')

  const [values, setValues] = useState({
    address: '', fullName: '', phone: '', email: '', apartments: '', notes: '',
  })
  const [organizing, setOrganizing] = useState<OrganizingStatusAnswer | ''>('')
  const [consent, setConsent] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({})
  const [attempted, setAttempted] = useState(false)
  const [status, setStatus] = useState<'idle' | 'sending' | 'failed' | 'sent'>('idle')

  function validate(): Partial<Record<FieldName, string>> {
    const next: Partial<Record<FieldName, string>> = {}
    if (!isPresent(values.address)) next.address = tErrors('addressRequired')
    if (!isPresent(values.fullName)) next.fullName = tErrors('nameRequired')
    if (!isPresent(values.phone)) next.phone = tErrors('phoneRequired')
    else if (!isValidPhone(values.phone)) next.phone = tErrors('phoneInvalid')
    if (isPresent(values.email) && !isValidEmail(values.email)) {
      next.email = tErrors('emailInvalid')
    }
    if (!isValidApartmentCount(values.apartments)) {
      next.apartments = tErrors('apartmentsInvalid')
    }
    if (!consent) next.consent = tErrors('consentRequired')
    return next
  }

  /** Updates a value, and clears its error only if it already had one. */
  function update(name: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [name]: value }))
    if (attempted && errors[name]) {
      setErrors((current) => {
        const next = { ...current }
        delete next[name]
        return next
      })
    }
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    // Guards a double submit from a second click or an Enter keypress while
    // the first request is still open.
    if (status === 'sending') return

    setAttempted(true)
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setStatus('sending')

    const submission: EligibilitySubmission = {
      address: values.address.trim(),
      fullName: values.fullName.trim(),
      // Normalised here, once, so the CRM never receives two spellings of the
      // same number. What the visitor typed is left alone on screen.
      phone: normalisePhone(values.phone),
      ...(isPresent(values.email) ? { email: values.email.trim() } : {}),
      ...(isPresent(values.apartments)
        ? { approximateApartmentCount: Number(values.apartments.trim()) }
        : {}),
      ...(organizing ? { organizingStatus: organizing } : {}),
      ...(isPresent(values.notes) ? { notes: values.notes.trim() } : {}),
      consent: true,
      metadata: buildSubmissionMetadata(`/${locale}/eligibility`, locale),
    }

    const outcome = await getLeadSubmissionService().submitEligibility(submission)
    setStatus(outcome.ok ? 'sent' : 'failed')
  }

  if (status === 'sent') {
    return (
      <SubmissionSuccess title={t('successTitle')} body={t('successBody')}>
        <p className="text-[15px] leading-relaxed text-gray-600">{t('successLinkIntro')}</p>
        <Link
          href="/how-we-work"
          className="group mt-4 inline-flex items-center gap-2 text-[15px] font-semibold text-teal-700"
        >
          <span className="border-b border-transparent pb-0.5 transition-colors group-hover:border-teal-700">
            {tLinks('howWeWork')}
          </span>
          <span
            aria-hidden="true"
            className="inline-block transition-transform duration-200 group-hover:translate-x-[3px] rtl:rotate-180"
          >
            →
          </span>
        </Link>
      </SubmissionSuccess>
    )
  }

  // Ordered to match the visual field order, so the summary reads top to
  // bottom rather than in whatever order the object happens to enumerate.
  const summary = (['address', 'fullName', 'phone', 'email', 'apartments', 'consent'] as const)
    .filter((name) => errors[name])
    .map((name) => ({ id: `eligibility-${name}`, message: errors[name]! }))

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <ErrorSummary title={tForms('errorSummaryTitle')} errors={summary} />

      <Field id="eligibility-address" required error={errors.address}>
        <FieldLabel requiredLabel={tForms('required')}>{t('addressLabel')}</FieldLabel>
        <Input
          controlSize="comfortable"
          autoComplete="street-address"
          value={values.address}
          onChange={(e) => update('address', e.target.value)}
        />
        {/* gray-600 rather than the primitive's gray-500: 12px gray-500 is
            4.47:1, below AA. Overridden locally so the CRM is untouched; the
            shared correction is documented for its own UI audit. */}
        <FieldDescription className="text-gray-600">{t('addressHint')}</FieldDescription>
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="eligibility-fullName" required error={errors.fullName}>
          <FieldLabel requiredLabel={tForms('required')}>{t('nameLabel')}</FieldLabel>
          <Input
            controlSize="comfortable"
            autoComplete="name"
            value={values.fullName}
            onChange={(e) => update('fullName', e.target.value)}
          />
        </Field>

        <Field id="eligibility-phone" required error={errors.phone}>
          <FieldLabel requiredLabel={tForms('required')}>{t('phoneLabel')}</FieldLabel>
          {/* `inputMode="tel"` opens the numeric keypad; `dir="ltr"` keeps a
              phone number reading left to right inside an RTL page. */}
          <Input
            controlSize="comfortable"
            type="tel"
            inputMode="tel"
            dir="ltr"
            autoComplete="tel"
            value={values.phone}
            onChange={(e) => update('phone', e.target.value)}
          />
        </Field>
      </div>

      <OptionalDivider label={tForms('optionalDivider')} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="eligibility-email" error={errors.email}>
          <FieldLabel requiredLabel={tForms('required')}>{t('emailLabel')}</FieldLabel>
          <Input
            controlSize="comfortable"
            type="email"
            inputMode="email"
            dir="ltr"
            autoComplete="email"
            value={values.email}
            onChange={(e) => update('email', e.target.value)}
          />
        </Field>

        <Field id="eligibility-apartments" error={errors.apartments}>
          <FieldLabel requiredLabel={tForms('required')}>{t('apartmentsLabel')}</FieldLabel>
          <Input
            controlSize="comfortable"
            type="text"
            inputMode="numeric"
            value={values.apartments}
            onChange={(e) => update('apartments', e.target.value)}
          />
          <FieldDescription className="text-gray-600">{t('apartmentsHint')}</FieldDescription>
        </Field>
      </div>

      <fieldset className="border-0 p-0">
        <legend className="mb-2 block text-sm font-medium text-gray-800">
          {t('organizingLabel')}
          <span className="ms-1.5 text-xs font-normal text-gray-600">{tForms('optional')}</span>
        </legend>
        <RadioGroup
          ariaLabel={t('organizingLabel')}
          value={organizing}
          onValueChange={(value) => setOrganizing(value as OrganizingStatusAnswer)}
          options={ORGANIZING_OPTIONS.map((value) => ({ value, label: tOrg(value) }))}
        />
      </fieldset>

      <Field id="eligibility-notes">
        <FieldLabel requiredLabel={tForms('required')}>{t('notesLabel')}</FieldLabel>
        <Textarea
          controlSize="comfortable"
          rows={4}
          value={values.notes}
          onChange={(e) => update('notes', e.target.value)}
        />
      </Field>

      <Checkbox
        id="eligibility-consent"
        checked={consent}
        onCheckedChange={(next) => {
          setConsent(next === true)
          if (attempted && next === true) {
            setErrors((current) => {
              const rest = { ...current }
              delete rest.consent
              return rest
            })
          }
        }}
        error={errors.consent}
        label={
          <>
            {tForms('consentLabel')}{' '}
            <Link href="/privacy" className="underline underline-offset-2">
              {tForms('consentLinkText')}
            </Link>
            <span aria-hidden="true" className="ms-1 text-red-600">*</span>
            <span className="sr-only"> ({tForms('required')})</span>
          </>
        }
      />

      {status === 'failed' && (
        <SubmissionFailureNotice
          title={tForms('failureTitle')}
          body={tForms('failureBody')}
          retryLabel={tForms('retry')}
          onRetry={() => setStatus('idle')}
        />
      )}

      {status !== 'failed' && (
        <Button
          type="submit"
          size="lg"
          loading={status === 'sending'}
          loadingLabel={tForms('loadingLabel')}
          className="min-h-[44px] self-start"
        >
          {status === 'sending' ? tForms('submitting') : t('submit')}
        </Button>
      )}

      {/* Approved wording, used once on this page. Flagged for legal review
          before production; see docs/ODG_CONTENT_QUESTIONS.md §1. */}
      <p className="text-sm leading-relaxed text-gray-600">{tForms('noCost')}</p>
    </form>
  )
}
