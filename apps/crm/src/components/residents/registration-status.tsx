import type { RegistrationStatus } from '@/hooks/use-portal-registrations'

const LABELS: Record<RegistrationStatus, { label: string; className: string }> = {
  PENDING: { label: 'ממתינה לאישור', className: 'bg-amber-50 text-amber-800' },
  APPROVED: { label: 'אושרה', className: 'bg-green-50 text-green-800' },
  REJECTED: { label: 'נדחתה', className: 'bg-gray-100 text-gray-700' },
}

/** A registration request's status in words, never in colour alone. */
export function RegistrationStatusBadge({ status }: { status: RegistrationStatus }) {
  const { label, className } = LABELS[status] ?? LABELS.PENDING
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}>{label}</span>
}
