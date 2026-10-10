import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { protocolPreparedBy } from '@urban-renewal/api-contracts'
import { apiGet, NotAuthenticated } from '@/lib/api'
import type { PortalFormCopy } from '@/lib/forms'
import { ProtocolView } from '@/components/forms/protocol-view'
import { PrintButton } from '@/components/forms/print-button'

export const dynamic = 'force-dynamic'

/**
 * A resident's copy of a signed form. An owner sees the protocol as sent and
 * their own row; a representation member sees the combined document, every
 * signed row included. The gateway decides which (GET /portal/forms/:id),
 * scoped by the session, so somebody else's form is simply not found.
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

  const combined = copy.kind === 'COMBINED'

  return (
    <div className="space-y-4 pb-10 print:pb-0">
      <div className="space-y-2 print:hidden">
        <Link href={`/${locale}/dashboard`} className="inline-flex min-h-11 items-center text-sm font-semibold text-teal-700">
          חזרה לאזור האישי
        </Link>
        <h1 className="text-xl font-bold text-gray-800">{combined ? 'המסמך המאוחד' : 'העותק שלי'}</h1>
        <p className="text-sm text-gray-600">
          {copy.kind === 'COMBINED'
            ? `כחברי נציגות, אתם רואים את כל השורות שנחתמו (${copy.totals.signed} מתוך ${copy.totals.owners} בעלי דירות).`
            : 'הנוסח כפי שנשלח אליכם, והשורה שחתמתם עליה.'}
        </p>
        <PrintButton />
      </div>

      <ProtocolView
        text={copy.text}
        meeting={copy.meeting}
        members={copy.representatives.map((m) => ({
          fullName: m.fullName,
          apartmentNumber: m.apartmentNumber,
          ...(combined && 'idNumber' in m
            ? { idNumber: m.idNumber, signatureImage: m.signatureImage, method: m.method }
            : {}),
        }))}
        rows={copy.rows}
        titleLevel={2}
        preparedBy={protocolPreparedBy(copy.text, copy.preparerIdNumber ?? undefined)}
      />
    </div>
  )
}
