'use client'

import { useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Copy, MessageCircle, Plus, X } from 'lucide-react'
import { Button, Checkbox, Field, FieldLabel, Input } from '@urban-renewal/ui'
import { REPRESENTATION_PROTOCOL } from '@urban-renewal/api-contracts'
import { Link } from '@/i18n/navigation'
import { useFormIdentity } from '@/lib/forms/use-form-identity'
import { messageOf, postPublicForm } from '@/lib/public-forms'
import { ProtocolDocument } from './protocol-document'
import { EMPTY_ROW, ProtocolRowFields, rowErrors, type RowErrors, type RowValues } from './protocol-row-fields'

const PRIVACY_POLICY_VERSION = '2026-09-08'
const MAX_MEMBERS = 15

interface Member {
  fullName: string
  apartmentNumber: string
}

/**
 * Starting the representation protocol for a building that is not yet a
 * project. The owner fills in the building, the meeting and the proposed
 * members, reads the protocol (shown with what they filled in), adds their
 * own row and signs. What comes back is the link for their neighbours, and a
 * lead for the company to call them back.
 *
 * The wording sent is @urban-renewal/api-contracts' own; the gateway keeps it
 * only if it is the approved version.
 */
export function StartProtocolForm() {
  const t = useTranslations('pages.forms')
  const tForms = useTranslations('forms')
  const locale = useLocale() as 'he' | 'en'
  const identity = useFormIdentity()

  const [building, setBuilding] = useState({ address: '', city: '', compoundName: '' })
  const [meeting, setMeeting] = useState({ meetingDate: '', meetingPlace: '' })
  const [members, setMembers] = useState<Member[]>([
    { fullName: '', apartmentNumber: '' },
    { fullName: '', apartmentNumber: '' },
  ])
  const [row, setRow] = useState<RowValues>(EMPTY_ROW)
  const [signature, setSignature] = useState<string | null>(null)
  const [confirmRead, setConfirmRead] = useState(false)
  const [consentContact, setConsentContact] = useState(false)
  const [consentPrivacy, setConsentPrivacy] = useState(false)
  const [company, setCompany] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [rowProblems, setRowProblems] = useState<RowErrors>({})
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [copied, setCopied] = useState(false)
  const doneHeading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (!done) return
    doneHeading.current?.focus({ preventScroll: true })
    doneHeading.current?.scrollIntoView({ block: 'start' })
  }, [done])

  const filledMembers = members.filter((m) => m.fullName.trim() && m.apartmentNumber.trim())
  const compoundName = building.compoundName.trim() || building.address.trim()

  function validate() {
    const next: Record<string, string> = {}
    if (building.address.trim().length < 2) next.address = tForms('errors.addressRequired')
    if (building.city.trim().length < 2) next.city = tForms('errors.cityRequired')
    if (!meeting.meetingDate) next.meetingDate = t('meetingDateRequired')
    if (meeting.meetingPlace.trim().length < 2) next.meetingPlace = t('meetingPlaceRequired')
    if (filledMembers.length === 0) next.members = t('memberRequired')
    if (!consentContact) next.consentContact = tForms('errors.contactConsentRequired')
    if (!consentPrivacy) next.consentPrivacy = tForms('errors.privacyConsentRequired')
    const problems = rowErrors(t, tForms, row, signature, confirmRead, true)
    setErrors(next)
    setRowProblems(problems)
    return Object.keys(next).length === 0 && Object.keys(problems).length === 0
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setFailure(null)
    if (!validate()) return
    setBusy(true)
    try {
      const { submissionId, renderedAt } = identity.read()
      const res = await postPublicForm<{ shareToken: string | null }>('', {
        submissionId,
        renderedAt,
        company,
        locale,
        privacyPolicyVersion: PRIVACY_POLICY_VERSION,
        consentContact: true,
        consentPrivacy: true,
        templateId: REPRESENTATION_PROTOCOL.id,
        text: REPRESENTATION_PROTOCOL,
        building: { address: building.address, city: building.city, ...(building.compoundName.trim() ? { compoundName: building.compoundName } : {}) },
        meeting,
        members: filledMembers,
        initiator: { ...row, signatureImage: signature, confirmedRead: confirmRead },
      })
      if (!res.ok) {
        setFailure(res.status === 429 ? tForms('failureRateLimited') : messageOf(res.data, t('error')))
        return
      }
      setShareUrl(res.data.shareToken ? `${window.location.origin}/${locale}/forms/join/${res.data.shareToken}` : null)
      setDone(true)
    } catch {
      setFailure(t('error'))
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    const whatsapp = shareUrl ? `https://wa.me/?text=${encodeURIComponent(`${t('shareText')} ${shareUrl}`)}` : null
    return (
      <section aria-labelledby="start-done" className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
        <h2 id="start-done" ref={doneHeading} tabIndex={-1} className="scroll-mt-24 type-h3 font-bold text-gray-900 outline-none">
          {t('startDoneHeading')}
        </h2>
        <p className="mt-3 max-w-prose type-body text-gray-700">{t('startDoneBody')}</p>
        {shareUrl && (
          <>
            <p dir="ltr" className="mt-5 break-all rounded-md bg-surface-sunken px-4 py-3 text-sm text-gray-800">
              {shareUrl}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                className="min-h-12 gap-2"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(shareUrl)
                    setCopied(true)
                  } catch {
                    window.prompt(t('copyLink'), shareUrl)
                  }
                }}
              >
                <Copy size={16} aria-hidden="true" />
                {copied ? t('copied') : t('copyLink')}
              </Button>
              {whatsapp && (
                <a
                  href={whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-12 items-center gap-2 rounded-md bg-teal-600 px-5 type-body font-bold text-white hover:bg-teal-700 hover:text-white"
                >
                  <MessageCircle size={16} aria-hidden="true" />
                  {t('shareWhatsApp')}
                </a>
              )}
            </div>
          </>
        )}
      </section>
    )
  }

  const card = 'rounded-2xl border border-gray-200 bg-white p-6 sm:p-8'

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <section aria-labelledby="start-building" className={card}>
        <h2 id="start-building" className="type-h3 font-bold text-gray-900">
          {t('buildingHeading')}
        </h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field id="start-address" required error={errors.address}>
            <FieldLabel requiredLabel={tForms('required')}>{t('address')}</FieldLabel>
            <Input
              controlSize="comfortable"
              autoComplete="street-address"
              maxLength={200}
              value={building.address}
              onChange={(e) => setBuilding({ ...building, address: e.target.value })}
            />
          </Field>
          <Field id="start-city" required error={errors.city}>
            <FieldLabel requiredLabel={tForms('required')}>{t('city')}</FieldLabel>
            <Input
              controlSize="comfortable"
              autoComplete="address-level2"
              maxLength={80}
              value={building.city}
              onChange={(e) => setBuilding({ ...building, city: e.target.value })}
            />
          </Field>
          <Field id="start-compound">
            <FieldLabel>
              {t('compoundName')}
              <span className="ms-1 font-normal text-gray-600">({t('optional')})</span>
            </FieldLabel>
            <Input
              controlSize="comfortable"
              maxLength={120}
              value={building.compoundName}
              onChange={(e) => setBuilding({ ...building, compoundName: e.target.value })}
            />
          </Field>
        </div>
      </section>

      <section aria-labelledby="start-meeting" className={card}>
        <h2 id="start-meeting" className="type-h3 font-bold text-gray-900">
          {t('meetingHeading')}
        </h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field id="start-date" required error={errors.meetingDate}>
            <FieldLabel requiredLabel={tForms('required')}>{t('meetingDate')}</FieldLabel>
            <Input
              controlSize="comfortable"
              type="date"
              value={meeting.meetingDate}
              onChange={(e) => setMeeting({ ...meeting, meetingDate: e.target.value })}
            />
          </Field>
          <Field id="start-place" required error={errors.meetingPlace}>
            <FieldLabel requiredLabel={tForms('required')}>{t('meetingPlace')}</FieldLabel>
            <Input
              controlSize="comfortable"
              maxLength={160}
              value={meeting.meetingPlace}
              onChange={(e) => setMeeting({ ...meeting, meetingPlace: e.target.value })}
            />
          </Field>
        </div>
      </section>

      <section aria-labelledby="start-members" className={card}>
        <h2 id="start-members" className="type-h3 font-bold text-gray-900">
          {t('membersHeading')}
        </h2>
        <p className="mt-2 type-small text-gray-600">{t('membersHint')}</p>
        <ul className="mt-5 space-y-3">
          {members.map((member, index) => (
            <li key={index} className="grid grid-cols-[minmax(0,1fr)_6rem_2.75rem] items-end gap-3">
              <Field id={`member-${index}-name`}>
                <FieldLabel>{t('memberName')}</FieldLabel>
                <Input
                  controlSize="comfortable"
                  maxLength={80}
                  value={member.fullName}
                  onChange={(e) =>
                    setMembers(members.map((m, i) => (i === index ? { ...m, fullName: e.target.value } : m)))
                  }
                />
              </Field>
              <Field id={`member-${index}-apartment`}>
                <FieldLabel>{t('memberApartment')}</FieldLabel>
                <Input
                  controlSize="comfortable"
                  inputMode="numeric"
                  maxLength={10}
                  value={member.apartmentNumber}
                  onChange={(e) =>
                    setMembers(members.map((m, i) => (i === index ? { ...m, apartmentNumber: e.target.value } : m)))
                  }
                />
              </Field>
              <button
                type="button"
                onClick={() => setMembers(members.filter((_, i) => i !== index))}
                disabled={members.length === 1}
                className="flex h-11 w-11 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 hover:text-red-700 disabled:opacity-40"
                aria-label={t('removeMember')}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        {members.length < MAX_MEMBERS && (
          <button
            type="button"
            onClick={() => setMembers([...members, { fullName: '', apartmentNumber: '' }])}
            className="mt-4 inline-flex min-h-11 items-center gap-2 type-body font-semibold text-teal-700"
          >
            <Plus size={16} aria-hidden="true" />
            {t('addMember')}
          </button>
        )}
        {errors.members && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {errors.members}
          </p>
        )}
      </section>

      <details className="group rounded-2xl border border-gray-200 bg-white">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-6 type-body font-bold text-gray-900 marker:content-none sm:px-8 [&::-webkit-details-marker]:hidden">
          {t('readFull')}
          <span aria-hidden="true" className="text-teal-700 transition-transform group-open:rotate-45">
            <Plus size={20} />
          </span>
        </summary>
        <div className="border-t border-gray-200 bg-surface-page px-3 py-6 sm:px-6">
          <ProtocolDocument
            meeting={{
              compoundName,
              address: [building.address, building.city].filter((v) => v.trim()).join(', '),
              meetingDate: meeting.meetingDate,
              meetingPlace: meeting.meetingPlace,
            }}
            members={filledMembers}
            ownersTable={false}
            titleLevel={2}
          />
        </div>
      </details>

      <section aria-labelledby="start-row" className={card}>
        <h2 id="start-row" className="type-h3 font-bold text-gray-900">
          {t('rowHeading')}
        </h2>
        <div className="mt-5">
          <ProtocolRowFields
            idPrefix="start-row"
            values={row}
            onChange={setRow}
            onSignature={setSignature}
            confirmRead={confirmRead}
            onConfirmRead={setConfirmRead}
            phoneRequired
            errors={rowProblems}
          />
        </div>
      </section>

      <div aria-hidden="true" className="absolute start-[-10000px] top-auto h-px w-px overflow-hidden">
        <label htmlFor="start-company">Company</label>
        <input
          id="start-company"
          name="company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        />
      </div>

      <div className="space-y-3">
        <Checkbox
          id="start-consentContact"
          checked={consentContact}
          onCheckedChange={(next) => setConsentContact(next === true)}
          error={errors.consentContact}
          label={tForms('contactConsentLabel')}
        />
        <Checkbox
          id="start-consentPrivacy"
          checked={consentPrivacy}
          onCheckedChange={(next) => setConsentPrivacy(next === true)}
          error={errors.consentPrivacy}
          label={
            <>
              {`${tForms('privacyConsentLabel')}\u00A0`}
              <Link href="/privacy" className="underline underline-offset-2">
                {tForms('consentLinkText')}
              </Link>
            </>
          }
        />
      </div>

      {failure && (
        <p role="alert" className="border-s-[3px] border-red-600 bg-red-50 p-4 text-sm text-red-800">
          {failure}
        </p>
      )}

      <Button type="submit" disabled={busy} className="min-h-12 w-full sm:w-auto">
        {busy ? t('sending') : t('startSubmit')}
      </Button>
    </form>
  )
}
