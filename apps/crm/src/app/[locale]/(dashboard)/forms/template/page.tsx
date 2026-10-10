'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { REPRESENTATION_PROTOCOL, protocolPreparedBy } from '@urban-renewal/api-contracts'
import { ProtocolView } from '@/components/forms/protocol-view'
import { PrintButton } from '@/components/forms/print-button'

/** The protocol's wording as it stands, blank: what every new form is sent with. */
export default function FormTemplatePage() {
  const { locale } = useParams<{ locale: string }>()
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <nav aria-label="מסלול ניווט" className="text-sm text-muted-foreground">
          <Link href={`/${locale}/forms`} className="font-medium text-teal-700 hover:underline">
            טפסים
          </Link>
          <span aria-hidden="true"> › </span>
          <span>הנוסח</span>
        </nav>
        <PrintButton />
      </div>
      <ProtocolView text={REPRESENTATION_PROTOCOL} preparedBy={protocolPreparedBy(REPRESENTATION_PROTOCOL)} />
    </div>
  )
}
