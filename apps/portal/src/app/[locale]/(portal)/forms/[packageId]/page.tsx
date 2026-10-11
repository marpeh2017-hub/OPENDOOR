import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { protocolPreparedBy, type OrganizingAgreement, type RepresentationProtocol } from '@urban-renewal/api-contracts'
import { apiGet, NotAuthenticated } from '@/lib/api'
import type { CombinedCopy, OwnCopy, PortalFormCopy } from '@/lib/forms'
import { ProtocolView } from '@/components/forms/protocol-view'
import { AgreementView } from '@/components/forms/agreement-view'
import { NoticeView } from '@/components/forms/notice-view'
import { PrintButton } from '@/components/forms/print-button'

export const dynamic = 'force-dynamic'

/**
 * A resident's copy of a form. An owner sees the document as sent and their
 * own row; a representation member sees the combined document, every signed
 * row included. The gateway decides which (GET /portal/forms/:id), scoped by
 * the session, so somebody else's form is simply not found. A notice is the
 * same for everyone: the notice with its assembly's details.
 */
export default async function FormCopyPage({
  params,
}: {
  params: Promise<{ locale: string; packageId: string }>
}) {
  const { locale, packageId } = await params

  let copy: PortalFormCopy
  try {
    copy = await apiGet<PortalFormCopy>(`portal/forms/${encodeURIComponent(packageId)}`)
  } catch (err) {
    if (err instanceof NotAuthenticated) redirect(`/${locale}/login${err.code ? `?reason=${err.code}` : ''}`)
    notFound()
  }

  const heading = copy.kind === 'NOTICE' ? 'ההודעה על הכינוס' : copy.kind === 'COMBINED' ? 'המסמך המאוחד' : 'העותק שלי'
  const intro =
    copy.kind === 'NOTICE'
      ? 'ההודעה כפי שנשלחה לבעלי הדירות.'
      : copy.kind === 'COMBINED'
        ? `כחברי נציגות, אתם רואים את כל השורות שנחתמו (${copy.totals.signed} מתוך ${copy.totals.owners} בעלי דירות).`
        : 'הנוסח כפי שנשלח אליכם, והשורה שחתמתם עליה.'

  return (
    <div className="space-y-4 pb-10 print:pb-0">
      <div className="space-y-2 print:hidden">
        <Link href={`/${locale}/dashboard`} className="inline-flex min-h-11 items-center text-sm font-semibold text-teal-700">
          חזרה לאזור האישי
        </Link>
        <h1 className="text-xl font-bold text-gray-800">{heading}</h1>
        <p className="text-sm text-gray-600">{intro}</p>
        <PrintButton />
      </div>

      {copy.kind === 'NOTICE' ? (
        <NoticeView
          text={copy.text}
          fields={copy.fields}
          meetingDate={copy.meeting.meetingDate}
          meetingPlace={copy.meeting.meetingPlace}
          titleLevel={2}
        />
      ) : (
        <SignedCopy copy={copy} />
      )}
    </div>
  )
}

function SignedCopy({ copy }: { copy: OwnCopy | CombinedCopy }) {
  const combined = copy.kind === 'COMBINED'
  const members = copy.representatives.map((m) => ({
    fullName: m.fullName,
    apartmentNumber: m.apartmentNumber,
    ...(combined && 'idNumber' in m ? { idNumber: m.idNumber, signatureImage: m.signatureImage, method: m.method } : {}),
  }))

  if (copy.formType === 'ORGANIZING_AGREEMENT') {
    return (
      <AgreementView
        text={copy.text as OrganizingAgreement}
        fields={copy.fields}
        representatives={members}
        rows={copy.rows}
        determiningDate={copy.determiningDate}
        organizer={copy.organizer}
        titleLevel={2}
      />
    )
  }

  const text = copy.text as RepresentationProtocol
  return (
    <ProtocolView
      text={text}
      meeting={copy.meeting}
      members={members}
      rows={copy.rows}
      titleLevel={2}
      preparedBy={protocolPreparedBy(text, copy.preparerIdNumber ?? undefined)}
    />
  )
}
