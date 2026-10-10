'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useForm } from '@/hooks/use-forms'
import { FormSetup } from '@/components/forms/form-setup'
import { FormTracking } from '@/components/forms/form-tracking'

/** One form: filled in while it is a draft, tracked once it is sent. */
export default function FormPage() {
  const { locale, id } = useParams<{ locale: string; id: string }>()
  const { data: form, isLoading, error } = useForm(id)

  if (isLoading) return <p className="text-sm text-muted-foreground">טוען…</p>
  if (error || !form) {
    return (
      <div className="space-y-3">
        <p role="alert" className="text-sm text-red-700">
          {error instanceof Error ? error.message : 'הטופס לא נמצא'}
        </p>
        <Link href={`/${locale}/forms`} className="text-sm font-medium text-teal-700 hover:underline">
          חזרה לטפסים
        </Link>
      </div>
    )
  }
  return form.status === 'DRAFT' ? <FormSetup form={form} locale={locale} /> : <FormTracking form={form} locale={locale} />
}
