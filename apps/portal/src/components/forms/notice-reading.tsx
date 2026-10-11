'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Phone } from 'lucide-react'
import type { AssemblyNotice } from '@urban-renewal/api-contracts'
import type { SigningFormView } from '@/lib/forms'
import { NoticeView } from './notice-view'

/**
 * The notice of an owners' assembly, from an owner's personal link: the
 * notice with this assembly's details, to read. Nothing to fill in and
 * nothing to sign; opening the link is what tells the company it arrived.
 */
export function NoticeReading({ initial }: { initial: SigningFormView }) {
  // An owner of several apartments gets the notice once, for all of them.
  const units = initial.signer.apartmentNumbers?.length ? initial.signer.apartmentNumbers : [initial.signer.apartmentNumber]
  const unitsLine =
    units.length > 1 ? `דירות ${units.slice(0, -1).join(', ')} ו־${units[units.length - 1]}` : `דירה ${units[0]}`

  return (
    <div dir="rtl" className="min-h-screen bg-[#FCFCFB] px-4 pb-16 pt-6">
      <div className="mx-auto w-full max-w-2xl space-y-5">
        <header className="flex items-center justify-between gap-3">
          <Image src="/brand/opendoor-logo.svg" alt="OpenDoor התחדשות עירונית" width={118} height={44} unoptimized priority className="h-11 w-auto" />
        </header>

        <div className="space-y-1">
          <h1 className="text-xl font-bold text-gray-900">שלום {initial.signer.fullName},</h1>
          <p className="text-sm text-gray-600">זו ההודעה על כינוס בעלי הדירות שנשלחה אליכם, {unitsLine}.</p>
        </div>

        <NoticeView
          text={initial.text as AssemblyNotice}
          fields={initial.fields}
          meetingDate={initial.meeting.meetingDate}
          meetingPlace={initial.meeting.meetingPlace}
          titleLevel={2}
        />

        <div className="space-y-3 rounded-xl bg-white p-4 ring-1 ring-border">
          <p className="text-sm text-gray-700">שאלה על הכינוס? דברו איתנו.</p>
          <a href="tel:+972548018613" className="flex min-h-11 w-fit items-center gap-2 text-sm font-semibold text-teal-700" dir="ltr">
            <Phone size={16} aria-hidden="true" />
            054-8018613
          </a>
          <Link
            href="/he/dashboard"
            className="flex min-h-12 w-full items-center justify-center rounded-lg bg-teal-600 px-4 text-sm font-bold text-white hover:bg-teal-700 hover:text-white"
          >
            לאזור האישי
          </Link>
        </div>
      </div>
    </div>
  )
}
