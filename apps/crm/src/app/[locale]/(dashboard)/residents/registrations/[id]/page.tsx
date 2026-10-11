'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { CheckCircle2, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api-client'
import {
  RELATION_LABELS,
  useApproveRegistration,
  useRegistration,
  useRejectRegistration,
  type ApproveResult,
  type RegistrationDetail,
} from '@/hooks/use-portal-registrations'
import { RegistrationStatusBadge } from '@/components/residents/registration-status'

/**
 * One registration request: who asked, what they confirmed, and the choice
 * that approves it, an apartment in the matched building and then either a
 * resident file already on it or a new one. Approving is what lets the
 * sign-in find them; the API tells them by SMS or email, and the WhatsApp
 * link is here either way.
 */
export default function RegistrationPage() {
  const { locale, id } = useParams<{ locale: string; id: string }>()
  const { data: row, isLoading, error } = useRegistration(id)

  if (isLoading) return <p className="text-sm text-muted-foreground">טוען…</p>
  if (error || !row) {
    return (
      <div className="space-y-3">
        <p role="alert" className="text-sm text-red-700">
          {error instanceof Error ? error.message : 'הבקשה לא נמצאה'}
        </p>
        <Link href={`/${locale}/residents/registrations`} className="text-sm font-medium text-teal-700 hover:underline">
          חזרה לבקשות
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <nav aria-label="מסלול ניווט" className="text-sm text-muted-foreground">
        <Link href={`/${locale}/residents`} className="font-medium text-teal-700 hover:underline">
          דיירים
        </Link>
        <span aria-hidden="true"> › </span>
        <Link href={`/${locale}/residents/registrations`} className="font-medium text-teal-700 hover:underline">
          בקשות הרשמה
        </Link>
        <span aria-hidden="true"> › </span>
        <span>{row.fullName}</span>
      </nav>

      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{row.fullName}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>בקשת הרשמה לאזור האישי · התקבלה ב־{new Date(row.createdAt).toLocaleDateString('he-IL')}</span>
            <RegistrationStatusBadge status={row.status} />
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Details row={row} />
        <Decision row={row} locale={locale} />
      </div>
    </div>
  )
}

function Details({ row }: { row: RegistrationDetail }) {
  const verified = <span className="ms-2 text-xs font-medium text-green-700">אומת בקוד</span>
  return (
    <section aria-labelledby="request-heading" className="card-surface space-y-4 p-5 text-sm">
      <h2 id="request-heading" className="font-semibold text-foreground">
        פרטי הבקשה
      </h2>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2.5">
        <dt className="text-muted-foreground">טלפון</dt>
        <dd>
          <a href={`tel:${row.phone}`} dir="ltr" className="font-medium text-teal-700 hover:underline">
            {row.phone}
          </a>
          {row.verifiedVia === 'SMS' && verified}
        </dd>
        <dt className="text-muted-foreground">אימייל</dt>
        <dd>
          {row.email ? (
            <a href={`mailto:${row.email}`} dir="ltr" className="font-medium text-teal-700 hover:underline">
              {row.email}
            </a>
          ) : (
            <span className="text-muted-foreground">לא נמסר</span>
          )}
          {row.verifiedVia === 'EMAIL' && verified}
        </dd>
        <dt className="text-muted-foreground">ת.ז</dt>
        <dd>
          {row.idNumber ? <span dir="ltr">{row.idNumber}</span> : <span className="text-muted-foreground">לא נמסרה</span>}
        </dd>
        <dt className="text-muted-foreground">הקשר לדירה</dt>
        <dd>{RELATION_LABELS[row.relation]}</dd>
        <dt className="text-muted-foreground">כתובת</dt>
        <dd>
          {row.address}, {row.city}
        </dd>
        <dt className="text-muted-foreground">דירה</dt>
        <dd>{row.apartmentNumber}</dd>
      </dl>
    </section>
  )
}

function Decision({ row, locale }: { row: RegistrationDetail; locale: string }) {
  const approve = useApproveRegistration(row.id)
  const reject = useRejectRegistration(row.id)
  const apartments = row.building?.apartments ?? []
  const [apartmentId, setApartmentId] = useState(
    () => apartments.find((a) => a.suggested)?.id ?? apartments[0]?.id ?? '',
  )
  const [choice, setChoice] = useState<string>('new')
  const [replacePhone, setReplacePhone] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [note, setNote] = useState('')
  const [result, setResult] = useState<ApproveResult | null>(null)

  const apartment = apartments.find((a) => a.id === apartmentId)
  const resident = apartment?.residents.find((r) => r.id === choice)
  const phoneDiffers = Boolean(resident?.phone && resident.phone !== row.phone)

  // A different apartment starts from a new file, and no replacement is assumed.
  useEffect(() => {
    setChoice('new')
    setReplacePhone(false)
  }, [apartmentId])

  async function approveNow() {
    const done = await approve.mutateAsync(
      resident ? { residentId: resident.id, ...(phoneDiffers ? { replacePhone } : {}) } : { apartmentId },
    )
    setResult(done)
  }

  const errorOf = (err: unknown) =>
    err instanceof ApiError || err instanceof Error ? err.message : 'הפעולה לא הושלמה'

  if (result) {
    return (
      <section aria-labelledby="decision-heading" className="card-surface space-y-3 p-5 text-sm" role="status">
        <h2 id="decision-heading" className="flex items-center gap-2 font-semibold text-green-800">
          <CheckCircle2 size={18} aria-hidden="true" />
          הבקשה אושרה
        </h2>
        <p className="text-foreground">
          {result.notifiedVia === 'SMS'
            ? 'נשלחה הודעת SMS עם קישור לכניסה.'
            : result.notifiedVia === 'EMAIL'
              ? 'נשלח אימייל עם קישור לכניסה.'
              : 'לא נשלחה הודעה אוטומטית. אפשר לשלוח בווטסאפ.'}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-2" asChild>
            <a href={result.whatsappUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle size={14} aria-hidden="true" />
              הודעה בווטסאפ
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/${locale}/residents/${result.residentId}`}>לתיק הדייר</Link>
          </Button>
        </div>
      </section>
    )
  }

  if (row.status !== 'PENDING') {
    return (
      <section aria-labelledby="decision-heading" className="card-surface space-y-3 p-5 text-sm">
        <h2 id="decision-heading" className="font-semibold text-foreground">
          החלטה
        </h2>
        <p className="text-foreground">
          {row.status === 'APPROVED' ? 'הבקשה אושרה' : 'הבקשה נדחתה'}
          {row.decidedAt ? ` ב־${new Date(row.decidedAt).toLocaleDateString('he-IL')}` : ''}.
        </p>
        {row.decisionNote && <p className="text-muted-foreground">סיבה: {row.decisionNote}</p>}
        {row.residentId && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/${locale}/residents/${row.residentId}`}>לתיק הדייר</Link>
          </Button>
        )}
      </section>
    )
  }

  return (
    <section aria-labelledby="decision-heading" className="card-surface space-y-4 p-5 text-sm">
      <h2 id="decision-heading" className="font-semibold text-foreground">
        צירוף לדירה
      </h2>

      {row.building && apartments.length > 0 ? (
        <>
          <p className="text-muted-foreground">
            הכתובת תואמת בניין במערכת: {row.building.address}
            {row.building.city ? `, ${row.building.city}` : ''} · {row.building.project.name}
          </p>

          <div className="space-y-1.5">
            <label htmlFor="reg-apartment" className="block font-medium text-foreground">
              דירה
            </label>
            <select
              id="reg-apartment"
              value={apartmentId}
              onChange={(e) => setApartmentId(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-72"
            >
              {apartments.map((a) => (
                <option key={a.id} value={a.id}>
                  דירה {a.apartmentNumber}
                  {a.residents.length ? ` · ${a.residents.length} בתיק` : ''}
                  {a.suggested ? ' · הדירה שציין/ה' : ''}
                </option>
              ))}
            </select>
          </div>

          <fieldset className="space-y-1">
            <legend className="mb-1 font-medium text-foreground">לצרף ל</legend>
            {apartment?.residents.map((r) => (
              <label key={r.id} className="flex min-h-11 cursor-pointer items-start gap-2.5 rounded-md px-1 py-1.5 hover:bg-gray-50">
                <input
                  type="radio"
                  name="choice"
                  value={r.id}
                  checked={choice === r.id}
                  onChange={() => setChoice(r.id)}
                  className="mt-1 h-4 w-4 accent-teal-600"
                />
                <span>
                  <span className="block text-foreground">התיק הקיים של {r.name}</span>
                  <span className="block text-xs text-muted-foreground" dir="ltr">
                    {[r.phone, r.email].filter(Boolean).join(' · ') || 'בלי טלפון ואימייל'}
                  </span>
                </span>
              </label>
            ))}
            <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md px-1 py-1.5 hover:bg-gray-50">
              <input
                type="radio"
                name="choice"
                value="new"
                checked={choice === 'new'}
                onChange={() => setChoice('new')}
                className="h-4 w-4 accent-teal-600"
              />
              <span className="text-foreground">תיק דייר חדש בדירה הזו</span>
            </label>
          </fieldset>

          {phoneDiffers && (
            <label className="flex cursor-pointer items-start gap-2.5 rounded-md bg-amber-50 p-3 text-amber-900">
              <input
                type="checkbox"
                checked={replacePhone}
                onChange={(e) => setReplacePhone(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-amber-600"
              />
              <span>
                בתיק רשום טלפון אחר (<span dir="ltr">{resident?.phone}</span>). להחליף אותו ב־
                <span dir="ltr">{row.phone}</span>? אחרת צרו תיק דייר חדש בדירה.
              </span>
            </label>
          )}

          {approve.error && (
            <p role="alert" className="text-sm text-red-700">
              {errorOf(approve.error)}
            </p>
          )}

          <Button
            type="button"
            onClick={approveNow}
            disabled={approve.isPending || !apartmentId || (phoneDiffers && !replacePhone)}
          >
            {approve.isPending ? 'מאשר…' : 'אישור וצירוף לדירה'}
          </Button>
        </>
      ) : (
        <p className="rounded-md bg-gray-50 p-3 text-foreground">
          הכתובת לא תואמת אף בניין במערכת{row.leadId ? ', והבקשה נכנסה גם ללוח הלידים' : ''}. אחרי שהבניין והדירות
          יתווספו, הם יופיעו כאן לבחירה.
        </p>
      )}

      <div className="border-t border-border pt-4">
        {rejecting ? (
          <div className="space-y-2">
            <label htmlFor="reg-note" className="block font-medium text-foreground">
              סיבת הדחייה <span className="font-normal text-muted-foreground">(לא חובה, לשימוש פנימי)</span>
            </label>
            <textarea
              id="reg-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {reject.error && (
              <p role="alert" className="text-sm text-red-700">
                {errorOf(reject.error)}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-red-300 text-red-700 hover:bg-red-50"
                onClick={() => reject.mutate(note)}
                disabled={reject.isPending}
              >
                {reject.isPending ? 'דוחה…' : 'דחיית הבקשה'}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setRejecting(false)}>
                ביטול
              </Button>
            </div>
          </div>
        ) : (
          <Button type="button" variant="ghost" size="sm" className="text-red-700" onClick={() => setRejecting(true)}>
            דחיית הבקשה…
          </Button>
        )}
      </div>
    </section>
  )
}
