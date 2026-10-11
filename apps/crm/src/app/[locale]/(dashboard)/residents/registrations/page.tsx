'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  RELATION_LABELS,
  useRegistrations,
  type RegistrationListItem,
  type RegistrationStatus,
} from '@/hooks/use-portal-registrations'
import { RegistrationStatusBadge } from '@/components/residents/registration-status'

const TABS: { status: RegistrationStatus; label: string }[] = [
  { status: 'PENDING', label: 'ממתינות' },
  { status: 'APPROVED', label: 'אושרו' },
  { status: 'REJECTED', label: 'נדחו' },
]

/**
 * Personal-area registration requests: people the sign-in cannot find yet.
 * Waiting ones first; each opens to the apartment choice that approves it.
 */
export default function RegistrationsPage() {
  const { locale } = useParams<{ locale: string }>()
  const [status, setStatus] = useState<RegistrationStatus>('PENDING')
  const { data: rows, isLoading, error } = useRegistrations(status)

  return (
    <div className="space-y-6">
      <nav aria-label="מסלול ניווט" className="text-sm text-muted-foreground">
        <Link href={`/${locale}/residents`} className="font-medium text-teal-700 hover:underline">
          דיירים
        </Link>
        <span aria-hidden="true"> › </span>
        <span>בקשות הרשמה</span>
      </nav>

      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-foreground">בקשות הרשמה לאזור האישי</h1>
          <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
            מי שהטלפון או האימייל שלהם לא רשומים בתיק, ביקשו גישה ואימתו את פרטי הקשר בקוד. מאשרים בצירוף לדירה, ומאותו רגע
            הם נכנסים כמו כל דייר.
          </p>
        </div>
      </div>

      <div role="group" aria-label="סינון לפי סטטוס" className="inline-flex gap-1 rounded-lg bg-gray-100 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.status}
            type="button"
            aria-pressed={status === tab.status}
            onClick={() => setStatus(tab.status)}
            className={`min-h-9 rounded-md px-4 text-sm font-medium transition ${
              status === tab.status ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="card-surface overflow-x-auto">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">טוען…</p>
        ) : error ? (
          <p role="alert" className="p-6 text-sm text-red-700">
            {error instanceof Error ? error.message : 'הבקשות לא נטענו'}
          </p>
        ) : !rows?.length ? (
          <p className="p-6 text-sm text-muted-foreground">
            {status === 'PENDING' ? 'אין בקשות שממתינות.' : 'אין בקשות כאלה.'}
          </p>
        ) : (
          <table className="w-full min-w-[48rem] text-sm">
            <thead className="border-b border-border bg-gray-50 text-xs text-gray-600">
              <tr>
                <th scope="col" className="px-4 py-3 text-start font-semibold">מבקש/ת</th>
                <th scope="col" className="px-4 py-3 text-start font-semibold">כתובת ודירה</th>
                <th scope="col" className="px-4 py-3 text-start font-semibold">בניין במערכת</th>
                <th scope="col" className="px-4 py-3 text-start font-semibold">סטטוס</th>
                <th scope="col" className="px-4 py-3 text-start font-semibold">התקבלה</th>
                <th scope="col" className="px-4 py-3 text-start font-semibold">
                  <span className="sr-only">פעולות</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <Row key={row.id} row={row} locale={locale} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function Row({ row, locale }: { row: RegistrationListItem; locale: string }) {
  return (
    <tr className="align-middle">
      <td className="px-4 py-3">
        <p className="font-semibold text-foreground">{row.fullName}</p>
        <p className="text-xs text-muted-foreground">
          <span dir="ltr">{row.phone}</span> · {RELATION_LABELS[row.relation]}
        </p>
      </td>
      <td className="px-4 py-3 text-foreground">
        {row.address}, {row.city} · דירה {row.apartmentNumber}
      </td>
      <td className="px-4 py-3">
        {row.building ? (
          <span className="text-foreground">{row.building.projectName}</span>
        ) : (
          <span className="text-muted-foreground">לא במערכת{row.leadId ? ' · נוצר ליד' : ''}</span>
        )}
      </td>
      <td className="px-4 py-3">
        <RegistrationStatusBadge status={row.status} />
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(row.createdAt).toLocaleDateString('he-IL')}</td>
      <td className="px-4 py-3 text-end">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/${locale}/residents/registrations/${row.id}`}>{row.status === 'PENDING' ? 'טיפול' : 'צפייה'}</Link>
        </Button>
      </td>
    </tr>
  )
}
