'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { CheckCircle2, Phone, RefreshCw } from 'lucide-react'
import {
  AGREEMENT_CLAUSE_COUNT,
  PROTOCOL_CLAUSE_COUNT,
  protocolPlainText,
  type OrganizingAgreement,
  type RepresentationProtocol,
} from '@urban-renewal/api-contracts'
import { formatFormDate, type SigningFormView } from '@/lib/forms'
import { ProtocolView } from './protocol-view'
import { AgreementView } from './agreement-view'
import { SignaturePad } from './signature-pad'
import { isValidIsraeliId } from '@/lib/utils'

type Step = 'read' | 'details' | 'done'
type Call = (path: string, method?: string, body?: unknown) => Promise<any>

/**
 * Signing a form from the personal link: the representation-appointment
 * protocol, in two steps and no code (the owner's decision, 2026-10-10: a
 * code to confirm the reading made it cumbersome, and owners sign a scanned
 * paper today).
 *
 *   1. The full text, as it was sent, with this meeting's details and the
 *      representation members. The way on is at its end.
 *   2. The owner's own row of the signatures table: the name, the ID number
 *      (checked against the file by the gateway), phone and email if they
 *      wish, and a signature drawn. Phone and email come prefilled only for
 *      the owner signed in to the personal area: a forwarded link shows
 *      nobody's contact details.
 */
export function ProtocolSigning({ initial, call }: { initial: SigningFormView; call: Call }) {
  const form = initial
  // The organizing agreement is signed the same way (2026-10-11): the same two
  // steps, its own document and words.
  const isAgreement = form.type === 'ORGANIZING_AGREEMENT'
  const documentName = isAgreement ? 'ההסכם' : 'הפרוטוקול'
  const [step, setStep] = useState<Step>(initial.signed ? 'done' : 'read')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [row, setRow] = useState({
    fullName: initial.signer.fullName,
    idNumber: '',
    phone: initial.signer.phone ?? '',
    email: initial.signer.email ?? '',
  })
  const [signature, setSignature] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [signedAt, setSignedAt] = useState<string | null>(initial.signed?.signedAt ?? null)

  const idOk = isValidIsraeliId(row.idNumber)
  const canSign = row.fullName.trim().length >= 2 && idOk && Boolean(signature) && confirmed

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'משהו השתבש. נסו שוב.')
    } finally {
      setBusy(false)
    }
  }

  const sign = () =>
    run(async () => {
      await call('/sign', 'POST', {
        fullName: row.fullName,
        idNumber: row.idNumber,
        phone: row.phone,
        email: row.email,
        signatureImage: signature,
        confirmedRead: confirmed,
      })
      setSignedAt(new Date().toISOString())
      setStep('done')
    })

  const stepLabel = step === 'read' ? 1 : 2
  const inputClass =
    'w-full min-h-11 rounded-lg border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600'

  return (
    <div dir="rtl" className="min-h-screen bg-[#FCFCFB] px-4 pb-16 pt-6">
      <div className="mx-auto w-full max-w-2xl space-y-5">
        <header className="flex items-center justify-between gap-3">
          <Image src="/brand/opendoor-logo.svg" alt="OpenDoor התחדשות עירונית" width={118} height={44} unoptimized priority className="h-11 w-auto" />
          {step !== 'done' && (
            <p className="text-sm font-semibold text-gray-700">
              חתימה על מסמך · שלב {stepLabel} מתוך 2
            </p>
          )}
        </header>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {step === 'read' && (
          <>
            <div className="space-y-1">
              <h1 className="text-xl font-bold text-gray-900">שלום {form.signer.fullName},</h1>
              <p className="text-sm text-gray-600">
                זה הנוסח שנשלח אליכם לחתימה, דירה {form.signer.apartmentNumber}. הנוסח המלא,{' '}
                {isAgreement ? AGREEMENT_CLAUSE_COUNT : PROTOCOL_CLAUSE_COUNT} סעיפים.
              </p>
            </div>
            {isAgreement ? (
              <AgreementView
                text={form.text as OrganizingAgreement}
                fields={form.fields}
                representatives={form.representatives}
                ownersTable={false}
                titleLevel={2}
              />
            ) : (
              <ProtocolView
                text={form.text as RepresentationProtocol}
                meeting={form.meeting}
                members={form.representatives}
                ownersTable={false}
                titleLevel={2}
              />
            )}
            <div className="rounded-xl bg-white p-4 ring-1 ring-border">
              <p className="text-sm text-gray-700">
                סוף הנוסח. בשלב הבא תמלאו את השורה שלכם בטבלת החתימות ותחתמו.
              </p>
              <button
                type="button"
                onClick={() => {
                  setError(null)
                  setStep('details')
                  window.scrollTo({ top: 0 })
                }}
                className="mt-3 flex min-h-12 w-full items-center justify-center rounded-lg bg-teal-600 px-4 text-sm font-bold text-white hover:bg-teal-700"
              >
                המשך למילוי הפרטים
              </button>
            </div>
          </>
        )}

        {step === 'details' && (
          <section aria-labelledby="details-heading" className="space-y-5 rounded-2xl bg-white p-6 ring-1 ring-border">
            <div>
              <h1 id="details-heading" className="text-lg font-bold text-gray-900">
                השורה שלך בטבלת החתימות
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                מילאנו את מה שאפשר. בדקו, השלימו את מספר תעודת הזהות, וחתמו.
              </p>
            </div>

            <dl className="grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-3 text-sm">
              <div>
                <dt className="text-gray-500">מס׳ דירה</dt>
                <dd className="font-semibold text-gray-900">{form.signer.apartmentNumber}</dd>
              </div>
              <div>
                <dt className="text-gray-500">תאריך</dt>
                <dd className="font-semibold text-gray-900">היום, {formatFormDate(form.today)}</dd>
              </div>
            </dl>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="row-name" className="text-sm font-semibold text-gray-800">שם מלא</label>
                <input
                  id="row-name"
                  value={row.fullName}
                  onChange={(e) => setRow((r) => ({ ...r, fullName: e.target.value }))}
                  autoComplete="name"
                  maxLength={80}
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="row-id" className="text-sm font-semibold text-gray-800">ת.ז</label>
                <input
                  id="row-id"
                  value={row.idNumber}
                  onChange={(e) => setRow((r) => ({ ...r, idNumber: e.target.value.replace(/[^\d]/g, '').slice(0, 9) }))}
                  inputMode="numeric"
                  dir="ltr"
                  aria-invalid={row.idNumber.length >= 5 && !idOk}
                  aria-describedby="row-id-hint"
                  className={inputClass}
                />
                <p id="row-id-hint" className={`text-xs ${row.idNumber.length >= 5 && !idOk ? 'text-red-700' : 'text-gray-500'}`}>
                  {row.idNumber.length >= 5 && !idOk ? 'מספר תעודת הזהות אינו תקין. בדקו את הספרות.' : '9 ספרות, כולל ספרת הביקורת.'}
                </p>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="row-phone" className="text-sm font-semibold text-gray-800">טלפון <span className="font-normal text-gray-500">(לא חובה)</span></label>
                <input
                  id="row-phone"
                  value={row.phone}
                  onChange={(e) => setRow((r) => ({ ...r, phone: e.target.value }))}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  dir="ltr"
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="row-email" className="text-sm font-semibold text-gray-800">אימייל <span className="font-normal text-gray-500">(לא חובה)</span></label>
                <input
                  id="row-email"
                  value={row.email}
                  onChange={(e) => setRow((r) => ({ ...r, email: e.target.value }))}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  dir="ltr"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="row-signature" className="text-sm font-semibold text-gray-800">חתימה</label>
              <SignaturePad id="row-signature" describedBy="row-signature-help" onChange={setSignature} />
              <p id="row-signature-help" className="text-xs text-gray-500">
                קשה לחתום כאן? פנו אלינו בטלפון 054-8018613, ונחתים אתכם על הטופס המודפס.
              </p>
            </div>

            {form.signer.isRepresentative && (
              <p className="rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-900">
                {/* The agreement has no representation table: its representatives
                    sign the "נציגות הדיירים" line at its end (approved 2026-10-12). */}
                {isAgreement
                  ? 'אתם גם בנציגות: החתימה הזו נכנסת גם לשורת ״נציגות הדיירים״ בסוף ההסכם, וגם לטבלת בעלי הדירות.'
                  : 'אתם גם חברי נציגות: החתימה הזו נכנסת לשתי הטבלאות, טבלת הנציגות וטבלת בעלי הדירות.'}
              </p>
            )}

            <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-gray-800">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-teal-600"
              />
              קראתי את נוסח {documentName} במלואו
            </label>

            <button
              type="button"
              onClick={sign}
              disabled={busy || !canSign}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-60"
            >
              {busy ? <RefreshCw size={16} className="animate-spin" aria-hidden="true" /> : null}
              חתימה ושליחה
            </button>
          </section>
        )}

        {step === 'done' && (
          <section aria-labelledby="done-heading" className="space-y-5 rounded-2xl bg-white p-6 text-center ring-1 ring-border">
            <span aria-hidden="true" className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-green-700">
              <CheckCircle2 size={30} />
            </span>
            <div>
              <h1 id="done-heading" className="text-xl font-bold text-gray-900">
                {initial.signed ? `כבר חתמתם על ${documentName}` : 'החתימה שלכם נקלטה'}
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                {initial.signed ? 'השורה שלכם כבר בטבלת החתימות.' : `תודה. השורה שלכם נוספה לטבלת החתימות של ${documentName}.`}
              </p>
            </div>
            <dl className="divide-y divide-border rounded-lg bg-gray-50 text-start text-sm">
              {[
                ['מסמך', protocolPlainText(form.text.title)],
                ['מתחם', form.meeting.compoundName],
                ['דירה', form.signer.apartmentNumber],
                ['נחתם', signedAt ? new Date(signedAt).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' }) : ''],
              ].map(([term, value]) => (
                <div key={term} className="flex justify-between gap-4 px-4 py-2.5">
                  <dt className="text-gray-500">{term}</dt>
                  <dd className="font-medium text-gray-900">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="text-sm text-gray-600">עותק של מה שחתמתם נשמר באזור האישי.</p>
            <a
              href="tel:+972548018613"
              className="mx-auto flex min-h-11 w-fit items-center gap-2 text-sm font-semibold text-teal-700"
              dir="ltr"
            >
              <Phone size={16} aria-hidden="true" />
              054-8018613
            </a>
            <Link
              href="/he/dashboard"
              className="flex min-h-12 w-full items-center justify-center rounded-lg bg-teal-600 px-4 text-sm font-bold text-white hover:bg-teal-700 hover:text-white"
            >
              חזרה לאזור האישי
            </Link>
          </section>
        )}
      </div>
    </div>
  )
}
