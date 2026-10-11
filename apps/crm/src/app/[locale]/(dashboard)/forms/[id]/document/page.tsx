'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  protocolPreparedBy,
  type AssemblyNotice,
  type OrganizingAgreement,
  type RepresentationProtocol,
} from '@urban-renewal/api-contracts'
import { useFormDocument, type FormDocument } from '@/hooks/use-forms'
import { ProtocolView } from '@/components/forms/protocol-view'
import { AgreementView } from '@/components/forms/agreement-view'
import { NoticeView } from '@/components/forms/notice-view'
import { PrintButton } from '@/components/forms/print-button'

/**
 * The combined document, per form. The protocol and the agreement: the text
 * as sent, the representation's table and every signed row of the owners'
 * table, each with the signature drawn or a note that it was signed on paper
 * (the agreement also with the company's signature and the determining
 * date). Printed (or saved as a PDF) it is the signed document the company
 * keeps and the representation receives. The notice: the notice as owners
 * got it, to print.
 */
export default function FormDocumentPage() {
  const { locale, id } = useParams<{ locale: string; id: string }>()
  const { data: doc, isLoading, error } = useFormDocument(id)
  const notice = doc?.formType === 'ASSEMBLY_NOTICE'

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <nav aria-label="מסלול ניווט" className="text-sm text-muted-foreground">
          <Link href={`/${locale}/forms`} className="font-medium text-teal-700 hover:underline">
            טפסים
          </Link>
          <span aria-hidden="true"> › </span>
          <Link href={`/${locale}/forms/${id}`} className="font-medium text-teal-700 hover:underline">
            {doc?.meeting.compoundName || 'הטופס'}
          </Link>
          <span aria-hidden="true"> › </span>
          <span>{notice ? 'ההודעה' : 'המסמך המאוחד'}</span>
        </nav>
        <div className="flex flex-wrap items-center gap-3">
          {doc && !notice && (
            <span className="text-sm text-muted-foreground">
              חתמו {doc.totals.signed} מתוך {doc.totals.owners} בעלי דירות
            </span>
          )}
          <PrintButton ready={Boolean(doc)} />
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">טוען…</p>}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error instanceof Error ? error.message : 'המסמך לא נטען'}
        </p>
      )}
      {doc && <DocumentFor doc={doc} />}
    </div>
  )
}

function DocumentFor({ doc }: { doc: FormDocument }) {
  const verification = (how: string) => (
    <p>
      <strong>אישור מערכת (נוסף למסמך, אינו חלק מנוסחו): </strong>
      {how} חתמו {doc.totals.signed} מתוך {doc.totals.owners} בעלי דירות
      {doc.documentHash ? (
        <>
          . מזהה המסמך: <span dir="ltr">{doc.documentHash.slice(0, 16)}</span>
        </>
      ) : null}
      .
    </p>
  )

  if (doc.formType === 'ASSEMBLY_NOTICE') {
    return (
      <NoticeView
        text={doc.text as AssemblyNotice}
        fields={doc.fields}
        meetingDate={doc.meeting.meetingDate}
        meetingPlace={doc.meeting.meetingPlace}
      />
    )
  }

  if (doc.formType === 'ORGANIZING_AGREEMENT') {
    return (
      <AgreementView
        text={doc.text as OrganizingAgreement}
        fields={doc.fields}
        representatives={doc.representatives}
        rows={doc.rows}
        determiningDate={doc.determiningDate}
        organizer={doc.organizer}
        verification={verification(
          'כל חתימה דיגיטלית בטבלה נחתמה בקישור אישי שנשלח לבעל הדירה, או באזור האישי, ונשמרו לה מועד החתימה ותיעוד מלא. חתימות שמסומנות ״נחתם ידנית״ נחתמו על הטופס המודפס, והסריקה שמורה במערכת. המועד הקובע הוא יום החתימה של בעל הדירה הראשון.',
        )}
      />
    )
  }

  const text = doc.text as RepresentationProtocol
  return (
    <ProtocolView
      text={text}
      meeting={doc.meeting}
      members={doc.representatives}
      rows={doc.rows}
      preparedBy={protocolPreparedBy(text, doc.preparerIdNumber ?? undefined)}
      verification={
        <p>
          <strong>אישור מערכת (נוסף לפרוטוקול, אינו חלק מנוסחו): </strong>
          כל חתימה דיגיטלית בטבלה נחתמה בקישור אישי שנשלח לבעל הדירה, או באזור האישי, ונשמרו לה מועד החתימה
          ותיעוד מלא. חתימות שמסומנות ״נחתם ידנית״ נחתמו על הטופס המודפס, והסריקה שמורה במערכת. חתמו{' '}
          {doc.totals.signed} מתוך {doc.totals.owners} בעלי דירות
          {doc.documentHash ? (
            <>
              . מזהה המסמך: <span dir="ltr">{doc.documentHash.slice(0, 16)}</span>
            </>
          ) : null}
          .
        </p>
      }
    />
  )
}
