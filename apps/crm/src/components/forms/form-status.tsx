import type { FormStatus } from '@/hooks/use-forms'

const LABELS: Record<FormStatus, { label: string; className: string }> = {
  DRAFT: { label: 'טיוטה', className: 'bg-gray-100 text-gray-700' },
  INTERNAL_REVIEW: { label: 'בבדיקה', className: 'bg-gray-100 text-gray-700' },
  APPROVED: { label: 'מאושר', className: 'bg-gray-100 text-gray-700' },
  SENT: { label: 'בחתימה', className: 'bg-teal-50 text-teal-800' },
  PARTIALLY_SIGNED: { label: 'בחתימה', className: 'bg-teal-50 text-teal-800' },
  COMPLETED: { label: 'הושלם · מסמך מאוחד מוכן', className: 'bg-green-50 text-green-800' },
  DECLINED: { label: 'נדחה', className: 'bg-red-50 text-red-800' },
  EXPIRED: { label: 'פג תוקף', className: 'bg-gray-100 text-gray-700' },
  CANCELLED: { label: 'בוטל', className: 'bg-gray-100 text-gray-700' },
}

/** A form's status in words, never in colour alone. A notice is read, never
 * signed, so once it is out it says so instead of "בחתימה". */
export function FormStatusBadge({ status, formType }: { status: FormStatus; formType?: string }) {
  const { label, className } = LABELS[status] ?? LABELS.DRAFT
  const sentNotice = formType === 'ASSEMBLY_NOTICE' && (status === 'SENT' || status === 'PARTIALLY_SIGNED')
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}>
      {sentNotice ? 'נשלחה' : label}
    </span>
  )
}

/** A website protocol's neighbours' link: open for signing, or closed by staff. */
export function WebsiteFormStatusBadge({ status }: { status: 'OPEN' | 'CLOSED' }) {
  return status === 'OPEN' ? (
    <span className="inline-flex rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-800">פתוח לחתימה</span>
  ) : (
    <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700">החתימה נסגרה</span>
  )
}
