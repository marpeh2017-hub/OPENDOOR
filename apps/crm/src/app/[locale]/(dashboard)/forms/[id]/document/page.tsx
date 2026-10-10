'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { protocolPreparedBy } from '@urban-renewal/api-contracts'
import { useFormDocument } from '@/hooks/use-forms'
import { ProtocolView } from '@/components/forms/protocol-view'
import { PrintButton } from '@/components/forms/print-button'

/**
 * The combined document: the protocol as sent, the representation table and
 * every signed row of the owners' table, each with the signature drawn or a
 * note that it was signed on paper. Printed (or saved as a PDF) it is the
 * signed protocol the company keeps and the representation receives.
 */
export default function FormDocumentPage() {
  const { locale, id } = useParams<{ locale: string; id: string }>()
  const { data: doc, isLoading, error } = useFormDocument(id)

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
          <span>המסמך המאוחד</span>
        </nav>
        <div className="flex flex-wrap items-center gap-3">
          {doc && (
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
      {doc && (
        <ProtocolView
          text={doc.text}
          meeting={doc.meeting}
          members={doc.representatives}
          rows={doc.rows}
          preparedBy={protocolPreparedBy(doc.text, doc.preparerIdNumber ?? undefined)}
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
      )}
    </div>
  )
}
