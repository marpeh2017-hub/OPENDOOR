'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRegistrations } from '@/hooks/use-portal-registrations'

/** The way to the personal-area registration requests, with how many wait. */
export function RegistrationsLink() {
  const { locale } = useParams<{ locale: string }>()
  const { data } = useRegistrations('PENDING')
  const pending = data?.length ?? 0

  return (
    <Button variant="outline" size="sm" className="gap-2" asChild>
      <Link href={`/${locale}/residents/registrations`}>
        <UserPlus size={15} aria-hidden="true" />
        בקשות הרשמה לאזור האישי
        {pending > 0 && (
          <span className="rounded-full bg-teal-600 px-2 py-0.5 text-xs font-bold text-white">
            {pending}
            <span className="sr-only"> ממתינות</span>
          </span>
        )}
      </Link>
    </Button>
  )
}
