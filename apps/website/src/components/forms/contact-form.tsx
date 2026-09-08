'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import {
  Field, FieldLabel, Input, Textarea, Checkbox, Button,
} from '@urban-renewal/ui'
import type { ContactSubmission, Locale } from '@urban-renewal/api-contracts'
import { Link } from '@/i18n/navigation'
import { buildSubmissionMetadata, getLeadSubmissionService } from '@/lib/submission'
import { isPresent, isValidEmail, isValidPhone, normalisePhone } from '@/lib/validation'
import { ErrorSummary, SubmissionFailureNotice, SubmissionSuccess } from './form-parts'

/**
 * General contact.
 *
 * ── DELIBERATELY THE QUIETER OF THE TWO ────────────────────────────────────
 *
 * Eligibility is the primary conversion; this is for everything else. Same
 * primitives, same validation rules, same honesty about submission — but no
 * optional-field divider (there are only four fields), no reassurance column,
 * no cost claim, and a smaller heading on the page around it.
 *
 * The nudge toward eligibility lives on the page, not in this form, and it is
 * a text link rather than a button: two buttons on one screen is two primary
 * actions, which is no primary action.
 */

type FieldName =
  | 'fullName'
  | 'phone'
  | 'email'
  | 'message'
  | 'consentContact'
  | 'consentPrivacy'

export function ContactForm() {
  const locale = useLocale() as Locale
  const t = useTranslations('contactPage')
  const tForms = useTranslations('forms')
  const tErrors = useTranslations('forms.errors')

  const [values, setValues] = useState({ fullName: '', phone: '', email: '', message: '' })
  const [consentContact, setConsentContact] = useState(false)
  const [consentPrivacy, setConsentPrivacy] = useState(false)
  const [company, setCompany] = useState('')
  const [formIdentity] = useState(() => ({
    submissionId: crypto.randomUUID(),
    renderedAt: new Date().toISOString(),
  }))
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({})
  const [attempted, setAttempted] = useState(false)
  const [status, setStatus] = useState<'idle' | 'sending' | 'failed' | 'sent'>('idle')

  function validate(): Partial<Record<FieldName, string>> {
    const next: Partial<Record<FieldName, string>> = {}
    if (!isPresent(values.fullName)) next.fullName = tErrors('nameRequired')
    if (!isPresent(values.phone)) next.phone = tErrors('phoneRequired')
    else if (!isValidPhone(values.phone)) next.phone = tErrors('phoneInvalid')
    if (isPresent(values.email) && !isValidEmail(values.email)) {
      next.email = tErrors('emailInvalid')
    }
    if (!isPresent(values.message)) next.message = tErrors('messageRequired')
    if (!consentContact) next.consentContact = tErrors('contactConsentRequired')
    if (!consentPrivacy) next.consentPrivacy = tErrors('privacyConsentRequired')
    return next
  }

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
    if (status === 'sending') return

    setAttempted(true)
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setStatus('sending')

    const submission: ContactSubmission = {
      fullName: values.fullName.trim(),
      phone: normalisePhone(values.phone),
      ...(isPresent(values.email) ? { email: values.email.trim() } : {}),
      message: values.message.trim(),
      consentContact: true,
      consentPrivacy: true,
      ...(company ? { company } : {}),
      metadata: buildSubmissionMetadata(`/${locale}/contact`, locale, formIdentity),
    }

    const outcome = await getLeadSubmissionService().submitContact(submission)
    setStatus(outcome.ok ? 'sent' : 'failed')
  }

  if (status === 'sent') {
    return <SubmissionSuccess title={t('successTitle')} body={t('successBody')} />
  }

  const summary = ([
    'fullName', 'phone', 'email', 'message', 'consentContact', 'consentPrivacy',
  ] as const)
    .filter((name) => errors[name])
    .map((name) => ({ id: `contact-${name}`, message: errors[name]! }))

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <ErrorSummary title={tForms('errorSummaryTitle')} errors={summary} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="contact-fullName" required error={errors.fullName}>
          <FieldLabel requiredLabel={tForms('required')}>{t('nameLabel')}</FieldLabel>
          <Input
            controlSize="comfortable"
            autoComplete="name"
            value={values.fullName}
            onChange={(e) => update('fullName', e.target.value)}
          />
        </Field>

        <Field id="contact-phone" required error={errors.phone}>
          <FieldLabel requiredLabel={tForms('required')}>{t('phoneLabel')}</FieldLabel>
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

      <Field id="contact-email" error={errors.email}>
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

      <Field id="contact-message" required error={errors.message}>
        <FieldLabel requiredLabel={tForms('required')}>{t('messageLabel')}</FieldLabel>
        <Textarea
          controlSize="comfortable"
          rows={6}
          value={values.message}
          onChange={(e) => update('message', e.target.value)}
        />
      </Field>

      <div aria-hidden="true" className="absolute start-[-10000px] top-auto h-px w-px overflow-hidden">
        <label htmlFor="contact-company">Company</label>
        <input
          id="contact-company"
          name="company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={company}
          onChange={(event) => setCompany(event.target.value)}
        />
      </div>

      <Checkbox
        id="contact-consentContact"
        checked={consentContact}
        onCheckedChange={(next) => {
          setConsentContact(next === true)
          if (attempted && next === true) {
            setErrors((current) => {
              const rest = { ...current }
              delete rest.consentContact
              return rest
            })
          }
        }}
        error={errors.consentContact}
        label={
          <>
            {tForms('contactConsentLabel')}
            <span aria-hidden="true" className="ms-1 text-red-600">*</span>
            <span className="sr-only"> ({tForms('required')})</span>
          </>
        }
      />

      <Checkbox
        id="contact-consentPrivacy"
        checked={consentPrivacy}
        onCheckedChange={(next) => {
          setConsentPrivacy(next === true)
          if (attempted && next === true) {
            setErrors((current) => {
              const rest = { ...current }
              delete rest.consentPrivacy
              return rest
            })
          }
        }}
        error={errors.consentPrivacy}
        label={
          <>
            {tForms('privacyConsentLabel')}{' '}
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
    </form>
  )
}
