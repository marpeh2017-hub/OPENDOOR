'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Lock, Mail, MessageCircle, MessageSquare, PenLine, Trash2, UserPlus, X } from 'lucide-react'
import {
  protocolPreparedBy,
  protocolPlainText,
  type AssemblyNotice,
  type OrganizingAgreement,
  type RepresentationProtocol,
} from '@urban-renewal/api-contracts'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  FORM_NAMES,
  deliveryOf,
  useCancelForm,
  useSendForm,
  useUpdateForm,
  type FormDetail,
  type FormMeeting,
} from '@/hooks/use-forms'
import { ProtocolView } from './protocol-view'
import { AgreementView } from './agreement-view'
import { NoticeView } from './notice-view'

type Member = { ownerId: string; apartmentId: string }

/** Each form's own sections, in the order of its steps. */
const STEPS: Record<FormDetail['formType'], string[]> = {
  REPRESENTATION_PROTOCOL: ['פרטי האסיפה', 'חברי הנציגות', 'נמענים', 'שליחה'],
  ORGANIZING_AGREEMENT: ['פרטי ההסכם', 'הנציגים', 'נמענים', 'שליחה'],
  ASSEMBLY_NOTICE: ['פרטי הכינוס', 'נמענים', 'שליחה'],
}

/**
 * A draft form: staff fill in what the form leaves open and, for the
 * protocol and the agreement, choose the representatives from the complex's
 * owners. The wording is locked. Sending opens the form and sends every
 * owner their personal link; after that nothing here can change, because
 * what was sent is what is signed (or, for the notice, what was announced).
 *
 * The protocol: the meeting's details and the representation members. The
 * agreement: the complex's street, city, block and parcel, and the
 * representatives who sign for the owners. The notice: the address line,
 * the date, the hour and the place.
 */
export function FormSetup({ form, locale }: { form: FormDetail; locale: string }) {
  const router = useRouter()
  const update = useUpdateForm(form.id)
  const send = useSendForm(form.id)
  const cancel = useCancelForm(form.id)

  const type = form.formType
  const isNotice = type === 'ASSEMBLY_NOTICE'
  const isAgreement = type === 'ORGANIZING_AGREEMENT'
  const withMembers = !isNotice

  const [meeting, setMeeting] = useState<FormMeeting>(form.meeting)
  const [fields, setFields] = useState<Record<string, string>>(form.fields ?? {})
  const [members, setMembers] = useState<Member[]>(
    form.representatives.map(({ ownerId, apartmentId }) => ({ ownerId, apartmentId })),
  )
  const [adding, setAdding] = useState('')
  const [preview, setPreview] = useState(false)
  const [confirmSend, setConfirmSend] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saved, setSaved] = useState(false)

  const rowKey = (m: Member) => `${m.ownerId}:${m.apartmentId}`
  const memberRows = members
    .map((m) => form.records.find((r) => r.ownerId === m.ownerId && r.apartmentId === m.apartmentId))
    .filter((r): r is FormDetail['records'][number] => Boolean(r))
  const candidates = form.records.filter((r) => !members.some((m) => rowKey(m) === rowKey(r)))
  // In a complex of several buildings "דירה 1" alone could be any of them.
  const severalBuildings = new Set(form.records.map((r) => r.buildingAddress)).size > 1

  // People, not rows: an owner of two apartments has a row for each. A notice
  // goes to each person once; a form to sign, once per apartment.
  const people = new Set(form.records.map((r) => r.ownerId)).size
  const delivery = useMemo(() => {
    const counts = { SMS: 0, EMAIL: 0, WHATSAPP: 0, NONE: 0 }
    const messages = isNotice ? [...new Map(form.records.map((r) => [r.ownerId, r])).values()] : form.records
    for (const record of messages) counts[deliveryOf(record, form.channels)]++
    return counts
  }, [form.records, form.channels, isNotice])

  const dirty =
    JSON.stringify(meeting) !== JSON.stringify(form.meeting) ||
    JSON.stringify(fields) !== JSON.stringify(form.fields ?? {}) ||
    JSON.stringify(members) !== JSON.stringify(form.representatives.map(({ ownerId, apartmentId }) => ({ ownerId, apartmentId })))

  const missing = (
    isAgreement
      ? [
          !fields.street?.trim() && 'רחוב',
          !fields.city?.trim() && 'עיר',
          !fields.gush?.trim() && 'גוש',
          !fields.helka?.trim() && 'חלקה',
          members.length === 0 && 'הנציגים',
        ]
      : isNotice
        ? [
            !fields.compound?.trim() && 'מתחם / כתובת',
            !meeting.meetingDate && 'תאריך הכינוס',
            !fields.meetingTime && 'שעת הכינוס',
            !meeting.meetingPlace.trim() && 'מקום הכינוס',
          ]
        : [
            !meeting.compoundName.trim() && 'שם המתחם',
            !meeting.address.trim() && 'כתובת',
            !meeting.meetingDate && 'תאריך',
            !meeting.meetingPlace.trim() && 'מקום הישיבה',
            members.length === 0 && 'חברי הנציגות',
          ]
  ).filter(Boolean) as string[]

  const payload = () => ({
    meeting,
    ...(type === 'REPRESENTATION_PROTOCOL' ? {} : { fields }),
    ...(withMembers ? { representatives: members } : {}),
  })

  async function save() {
    setSaved(false)
    await update.mutateAsync(payload())
    setSaved(true)
  }

  async function sendNow() {
    if (dirty) await update.mutateAsync(payload())
    await send.mutateAsync()
    setConfirmSend(false)
  }

  async function deleteDraft() {
    await cancel.mutateAsync()
    router.push(`/${locale}/forms`)
  }

  const inputClass =
    'w-full min-h-11 rounded-md border border-input bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

  const meetingField = (key: keyof FormMeeting, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="space-y-1.5">
      <label htmlFor={`meeting-${key}`} className="text-sm font-semibold text-foreground">
        {label}
      </label>
      <input
        id={`meeting-${key}`}
        value={meeting[key]}
        onChange={(e) => {
          setSaved(false)
          setMeeting((m) => ({ ...m, [key]: e.target.value }))
        }}
        className={inputClass}
        {...props}
      />
    </div>
  )

  const ownField = (key: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="space-y-1.5">
      <label htmlFor={`field-${key}`} className="text-sm font-semibold text-foreground">
        {label}
      </label>
      <input
        id={`field-${key}`}
        value={fields[key] ?? ''}
        onChange={(e) => {
          setSaved(false)
          setFields((f) => ({ ...f, [key]: e.target.value }))
        }}
        className={inputClass}
        {...props}
      />
    </div>
  )

  const mutationError = update.error ?? send.error
  const name = FORM_NAMES[type]
  const membersLabel = isAgreement ? 'הנציגים' : 'חברי הנציגות'

  return (
    <div className="space-y-6">
      <nav aria-label="מסלול ניווט" className="text-sm text-muted-foreground">
        <Link href={`/${locale}/forms`} className="font-medium text-teal-700 hover:underline">
          טפסים
        </Link>
        <span aria-hidden="true"> › </span>
        <span>{name}</span>
        <span aria-hidden="true"> › </span>
        <span>טיוטה</span>
      </nav>

      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {name} · {form.meeting.compoundName || form.project?.name}
          </h1>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Lock size={13} aria-hidden="true" />
            {isAgreement
              ? 'ממלאים את פרטי המתחם ואת הנציגים. הנוסח עצמו נעול ונשאר כפי שהוא.'
              : isNotice
                ? 'ממלאים את פרטי הכינוס. הנוסח עצמו נעול ונשאר כפי שהוא.'
                : 'ממלאים את פרטי האסיפה ואת חברי הנציגות. הנוסח עצמו נעול ונשאר כפי שהוא.'}
          </p>
        </div>
      </div>

      <ol className="flex flex-wrap gap-2 text-sm" aria-label="שלבי הטופס">
        {STEPS[type].map((step, index) => (
          <li key={step} className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 ring-1 ring-border">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-50 text-xs font-bold text-teal-700">
              {index + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <section aria-labelledby="details-heading" className="card-surface space-y-4 p-5">
            <h2 id="details-heading" className="text-base font-bold text-foreground">
              {STEPS[type][0]}
            </h2>
            {isAgreement ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  {ownField('street', 'רחוב', { maxLength: 120 })}
                  {ownField('city', 'עיר', { maxLength: 60 })}
                  {ownField('gush', 'גוש', { maxLength: 20, inputMode: 'numeric' })}
                  {ownField('helka', 'חלקה', { maxLength: 40 })}
                </div>
                <p className="text-xs text-muted-foreground">
                  המועד הקובע נכנס להסכם לבד: היום שבו חתם בעל הדירה הראשון.
                </p>
              </>
            ) : isNotice ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">{ownField('compound', 'מתחם / כתובת', { maxLength: 200 })}</div>
                {meetingField('meetingDate', 'תאריך הכינוס', { type: 'date' })}
                {ownField('meetingTime', 'שעת הכינוס', { type: 'time' })}
                <div className="sm:col-span-2">{meetingField('meetingPlace', 'מקום הכינוס', { maxLength: 160 })}</div>
              </div>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  {meetingField('compoundName', 'שם המתחם', { maxLength: 120 })}
                  {meetingField('address', 'כתובת', { maxLength: 200 })}
                  {meetingField('meetingDate', 'תאריך', { type: 'date' })}
                  {meetingField('meetingPlace', 'מקום הישיבה', { maxLength: 160 })}
                </div>
                <div className="rounded-md bg-gray-50 px-3 py-2 text-sm">
                  <span className="font-semibold">על סדר היום: </span>
                  {protocolPlainText((form.text as RepresentationProtocol).meeting.agenda).replace(/;$/, '')}
                  <span className="text-muted-foreground"> (מהנוסח)</span>
                </div>
              </>
            )}
          </section>

          {withMembers && (
            <section aria-labelledby="members-heading" className="card-surface space-y-4 p-5">
              <h2 id="members-heading" className="text-base font-bold text-foreground">
                {membersLabel}
              </h2>
              {memberRows.length > 0 ? (
                <table className="w-full text-sm">
                  <thead className="text-xs text-gray-600">
                    <tr className="border-b border-border">
                      <th scope="col" className="py-2 text-start font-semibold">שם מלא</th>
                      <th scope="col" className="py-2 text-start font-semibold">ת.ז</th>
                      <th scope="col" className="py-2 text-start font-semibold">דירה</th>
                      <th scope="col" className="py-2 text-start font-semibold">
                        <span className="sr-only">הסרה</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {memberRows.map((row) => (
                      <tr key={row.recordId}>
                        <td className="py-2 font-medium text-foreground">{row.ownerName}</td>
                        <td className="py-2 text-muted-foreground">בחתימה</td>
                        <td className="py-2">{row.apartmentNumber}</td>
                        <td className="py-2 text-end">
                          <button
                            type="button"
                            onClick={() => {
                              setSaved(false)
                              setMembers((list) => list.filter((m) => rowKey(m) !== rowKey(row)))
                            }}
                            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-red-700"
                            aria-label={`הסרת ${row.ownerName} מ${membersLabel}`}
                          >
                            <X size={16} aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-muted-foreground">עוד לא נבחרו {membersLabel}.</p>
              )}

              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[14rem] flex-1 space-y-1.5">
                  <label htmlFor="add-member" className="text-sm font-semibold text-foreground">
                    הוספה מרשימת הבעלים במתחם
                  </label>
                  <select
                    id="add-member"
                    value={adding}
                    onChange={(e) => setAdding(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">בחירת בעל דירה</option>
                    {candidates.map((r) => (
                      <option key={r.recordId} value={`${r.ownerId}:${r.apartmentId}`}>
                        {r.ownerName} · {severalBuildings ? `${r.buildingAddress}, ` : ''}דירה {r.apartmentNumber}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 gap-2"
                  disabled={!adding}
                  onClick={() => {
                    const [ownerId, apartmentId] = adding.split(':')
                    setSaved(false)
                    setMembers((list) => [...list, { ownerId, apartmentId }])
                    setAdding('')
                  }}
                >
                  <UserPlus size={16} aria-hidden="true" />
                  הוספה
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {isAgreement
                  ? 'הנציגים חותמים על ההסכם בשם בעלי הדירות: החתימה שלהם בשורה שלהם נכנסת גם לשורת ״נציגות הדיירים״.'
                  : 'חבר נציגות חותם פעם אחת, והחתימה נכנסת לשתי הטבלאות: טבלת הנציגות וטבלת בעלי הדירות.'}
              </p>
            </section>
          )}

          <section aria-labelledby="recipients-heading" className="card-surface space-y-3 p-5">
            <h2 id="recipients-heading" className="text-base font-bold text-foreground">
              נמענים
            </h2>
            <p className="text-sm text-foreground">
              {isNotice ? 'ההודעה תישלח' : 'הטופס יישלח'} ל-<strong>{people} בעלי דירות</strong> במתחם, כל
              אחד בקישור אישי.
            </p>
            {people < form.records.length && (
              <p className="text-xs text-muted-foreground">
                {isNotice
                  ? 'בעלים של כמה דירות במתחם יקבלו הודעה אחת.'
                  : 'בעלים של כמה דירות במתחם יקבלו קישור לכל דירה, ובכל הודעה כתוב לאיזו דירה היא.'}
              </p>
            )}
            <ul className="grid gap-2 sm:grid-cols-2">
              {form.channels.sms && (
                <li className="flex items-center gap-2 rounded-md bg-gray-50 px-3 py-2 text-sm">
                  <MessageSquare size={16} className="text-teal-600" aria-hidden="true" />
                  <strong>{delivery.SMS}</strong> ב-SMS
                </li>
              )}
              <li className="flex items-center gap-2 rounded-md bg-gray-50 px-3 py-2 text-sm">
                <Mail size={16} className="text-teal-600" aria-hidden="true" />
                <strong>{delivery.EMAIL}</strong> באימייל
              </li>
              {delivery.WHATSAPP > 0 && (
                <li className="flex items-center gap-2 rounded-md bg-gray-50 px-3 py-2 text-sm">
                  <MessageCircle size={16} className="text-teal-600" aria-hidden="true" />
                  <span>
                    <strong>{delivery.WHATSAPP}</strong> בווטסאפ, ממסך המעקב
                  </span>
                </li>
              )}
              <li className="flex items-center gap-2 rounded-md bg-gray-50 px-3 py-2 text-sm">
                <PenLine size={16} className="text-teal-600" aria-hidden="true" />
                <span>
                  <strong>{delivery.NONE}</strong> בלי טלפון ואימייל{isNotice ? '' : ': חתימה ידנית'}
                </span>
              </li>
            </ul>
            {!form.channels.sms && (
              <p className="text-xs text-muted-foreground">
                אין כרגע ספק SMS: למי שיש רק טלפון, שולחים את הקישור בווטסאפ ממסך המעקב, בלחיצה לכל דייר.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              מי שמחובר לאזור האישי יראה {isNotice ? 'את ההודעה' : 'את הטופס'} גם שם.
            </p>
          </section>

          {mutationError && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {mutationError instanceof Error ? mutationError.message : 'הפעולה נכשלה'}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={() => setConfirmSend(true)} disabled={missing.length > 0 || send.isPending}>
              {isNotice ? 'שליחה לבעלי הדירות' : 'שליחה לחתימה'}
            </Button>
            <Button type="button" variant="outline" onClick={save} disabled={!dirty || update.isPending}>
              {update.isPending ? 'שומר…' : 'שמירת טיוטה'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setPreview((p) => !p)} className="xl:hidden">
              {preview ? 'הסתרת התצוגה המקדימה' : 'תצוגה מקדימה'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="gap-2 text-red-700 hover:bg-red-50 hover:text-red-800"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={15} aria-hidden="true" />
              מחיקת טיוטה
            </Button>
            <span role="status" className="text-sm text-muted-foreground">
              {saved && !dirty ? 'הטיוטה נשמרה' : missing.length ? `לפני השליחה חסרים: ${missing.join(', ')}` : ''}
            </span>
          </div>
        </div>

        <section aria-label="תצוגה מקדימה" className={`${preview ? 'block' : 'hidden'} xl:block`}>
          {isAgreement ? (
            <AgreementView
              text={form.text as OrganizingAgreement}
              fields={fields}
              representatives={memberRows.map((row) => ({ fullName: row.ownerName }))}
              titleLevel={2}
            />
          ) : isNotice ? (
            <NoticeView
              text={form.text as AssemblyNotice}
              fields={fields}
              meetingDate={meeting.meetingDate}
              meetingPlace={meeting.meetingPlace}
              titleLevel={2}
            />
          ) : (
            <ProtocolView
              text={form.text as RepresentationProtocol}
              meeting={meeting}
              members={memberRows.map((row) => ({ fullName: row.ownerName, apartmentNumber: row.apartmentNumber }))}
              preparedBy={protocolPreparedBy(form.text as RepresentationProtocol)}
              titleLevel={2}
            />
          )}
        </section>
      </div>

      <ConfirmDialog
        open={confirmSend}
        onOpenChange={setConfirmSend}
        title={`לשלוח ל-${form.records.length} בעלי דירות?`}
        description={
          isNotice
            ? 'כל אחד יקבל קישור אישי להודעה. אחרי השליחה אי אפשר לשנות את פרטי הכינוס.'
            : isAgreement
              ? 'כל אחד יקבל קישור אישי לחתימה. אחרי השליחה אי אפשר לשנות את פרטי המתחם או את הנציגים.'
              : 'כל אחד יקבל קישור אישי לחתימה. אחרי השליחה אי אפשר לשנות את פרטי האסיפה או את חברי הנציגות.'
        }
        confirmLabel="שליחה"
        pending={send.isPending || update.isPending}
        error={send.error ?? update.error}
        onConfirm={sendNow}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="למחוק את הטיוטה?"
        description="הטיוטה לא נשלחה לאיש. אפשר ליצור טופס חדש בכל עת."
        confirmLabel="מחיקה"
        destructive
        pending={cancel.isPending}
        error={cancel.error}
        onConfirm={deleteDraft}
      />
    </div>
  )
}
