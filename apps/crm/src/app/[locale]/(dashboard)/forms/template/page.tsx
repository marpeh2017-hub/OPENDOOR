'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { ASSEMBLY_NOTICE, ORGANIZING_AGREEMENT, REPRESENTATION_PROTOCOL, protocolPreparedBy } from '@urban-renewal/api-contracts'
import { ProtocolView } from '@/components/forms/protocol-view'
import { AgreementView } from '@/components/forms/agreement-view'
import { NoticeView } from '@/components/forms/notice-view'
import { PrintButton } from '@/components/forms/print-button'
import { FORM_NAMES, formTypeOf } from '@/hooks/use-forms'

/** A template's wording as it stands, blank: what every new form of its kind is sent with. */
export default function FormTemplatePage() {
  // useSearchParams needs a boundary in the build.
  return (
    <Suspense fallback={null}>
      <FormTemplate />
    </Suspense>
  )
}

function FormTemplate() {
  const { locale } = useParams<{ locale: string }>()
  const type = formTypeOf(useSearchParams().get('type') ?? undefined)
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <nav aria-label="מסלול ניווט" className="text-sm text-muted-foreground">
          <Link href={`/${locale}/forms`} className="font-medium text-teal-700 hover:underline">
            טפסים
          </Link>
          <span aria-hidden="true"> › </span>
          <span>{FORM_NAMES[type]}: הנוסח</span>
        </nav>
        <PrintButton />
      </div>
      {type === 'ASSEMBLY_NOTICE' ? (
        <NoticeView text={ASSEMBLY_NOTICE} />
      ) : type === 'ORGANIZING_AGREEMENT' ? (
        <AgreementView text={ORGANIZING_AGREEMENT} />
      ) : (
        <ProtocolView text={REPRESENTATION_PROTOCOL} preparedBy={protocolPreparedBy(REPRESENTATION_PROTOCOL)} />
      )}
    </div>
  )
}
