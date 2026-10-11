'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { MessageCircle } from 'lucide-react'
import { Button, Checkbox } from '@urban-renewal/ui'
import { Link } from '@/i18n/navigation'
import { useFormIdentity } from '@/lib/forms/use-form-identity'
import { messageOf, postPublicForm } from '@/lib/public-forms'
import { EMPTY_ROW, ProtocolRowFields, rowErrors, type RowErrors, type RowValues } from './protocol-row-fields'

/**
 * A neighbour's row on a protocol started on the website: they have read the
 * text above, and add their own line of the owners' table. No sign-in and no
 * code; the company checks ownership against the land registry later, and
 * says so on the document.
 */
export function JoinProtocolForm({ token }: { token: string }) {
  const t = useTranslations('pages.forms')
  const tForms = useTranslations('forms')
  const identity = useFormIdentity()
  const [row, setRow] = useState<RowValues>(EMPTY_ROW)
  const [signature, setSignature] = useState<string | null>(null)
  const [confirmRead, setConfirmRead] = useState(false)
  const [consentPrivacy, setConsentPrivacy] = useState(false)
  const [company, setCompany] = useState('')
  const [problems, setProblems] = useState<RowErrors>({})
  const [privacyError, setPrivacyError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const doneHeading = useRef<HTMLHeadingElement>(null)

  // The form gives way to a short confirmation below the protocol; take the
  // reader (and a screen reader's focus) to it, as the site's other forms do.
  useEffect(() => {
    if (!done) return
    doneHeading.current?.focus({ preventScroll: true })
    doneHeading.current?.scrollIntoView({ block: 'start' })
  }, [done])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setFailure(null)
    const found = rowErrors(t, tForms, row, signature, confirmRead, false)
    setProblems(found)
    setPrivacyError(consentPrivacy ? null : tForms('errors.privacyConsentRequired'))
    if (Object.keys(found).length || !consentPrivacy) return
    setBusy(true)
    try {
      const res = await postPublicForm<{ signed: true; count: number }>(`/${encodeURIComponent(token)}/signatures`, {
        renderedAt: identity.read().renderedAt,
        company,
        consentPrivacy: true,
        ...row,
        signatureImage: signature,
        confirmedRead: confirmRead,
      })
      if (!res.ok) {
        setFailure(res.status === 429 ? tForms('failureRateLimited') : messageOf(res.data, t('error')))
        return
      }
      setDone(true)
    } catch {
      setFailure(t('error'))
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    const share = `https://wa.me/?text=${encodeURIComponent(`${t('shareText')} ${window.location.href}`)}`
    return (
      <section aria-labelledby="join-done" className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
        <h2 id="join-done" ref={doneHeading} tabIndex={-1} className="scroll-mt-24 type-h3 font-bold text-gray-900 outline-none">
          {t('joinDoneHeading')}
        </h2>
        <p className="mt-3 type-body text-gray-700">{t('joinDoneBody')}</p>
        <a
          href={share}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-md bg-teal-600 px-5 type-body font-bold text-white hover:bg-teal-700 hover:text-white"
        >
          <MessageCircle size={16} aria-hidden="true" />
          {t('shareWhatsApp')}
        </a>
      </section>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
      <h2 className="type-h3 font-bold text-gray-900">{t('rowHeading')}</h2>
      <ProtocolRowFields
        idPrefix="join-row"
        values={row}
        onChange={setRow}
        onSignature={setSignature}
        confirmRead={confirmRead}
        onConfirmRead={setConfirmRead}
        phoneRequired={false}
        errors={problems}
      />

      <div aria-hidden="true" className="absolute start-[-10000px] top-auto h-px w-px overflow-hidden">
        <label htmlFor="join-company">Company</label>
        <input
          id="join-company"
          name="company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        />
      </div>

      <Checkbox
        id="join-consentPrivacy"
        checked={consentPrivacy}
        onCheckedChange={(next) => setConsentPrivacy(next === true)}
        error={privacyError}
        label={
          <>
            {`${tForms('privacyConsentLabel')}\u00A0`}
            <Link href="/privacy" className="underline underline-offset-2">
              {tForms('consentLinkText')}
            </Link>
          </>
        }
      />

      {failure && (
        <p role="alert" className="border-s-[3px] border-red-600 bg-red-50 p-4 text-sm text-red-800">
          {failure}
        </p>
      )}

      <Button type="submit" disabled={busy} className="min-h-12 w-full sm:w-auto">
        {busy ? t('sending') : t('joinSubmit')}
      </Button>
    </form>
  )
}
