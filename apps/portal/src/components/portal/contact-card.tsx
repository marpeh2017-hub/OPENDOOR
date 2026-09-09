import { Phone, MessageCircle, Mail } from 'lucide-react'
import type { Dashboard } from '@/lib/dashboard'

/**
 * Who to talk to.
 *
 * The office numbers are company contact details already published on the
 * public website, so they stay hard-coded here. What was missing was WHO on the
 * project the resident is dealing with, which the endpoint now supplies by name
 * — and only by name and work address: the project manager's stored phone is
 * frequently a personal mobile, and publishing it to every resident is a
 * decision for the company to make deliberately rather than a consequence of
 * the column existing.
 */
export function ContactCard({ contact }: { contact: Dashboard['contact'] }) {
  const pm = contact.projectManager

  return (
    <div className="card-surface p-5">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">צור קשר עם הצוות</h3>

      {pm && (
        <div className="mb-3 rounded-xl bg-gray-50 px-3 py-2.5">
          <p className="text-xs text-gray-400">מנהל/ת הפרויקט שלך</p>
          <p className="text-sm font-medium text-gray-700">{pm.name}</p>
          {pm.email && (
            <a href={`mailto:${pm.email}`} className="text-xs text-teal-600 hover:text-teal-700" dir="ltr">
              {pm.email}
            </a>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <a
          href="tel:054-8018613"
          className="flex flex-col items-center gap-1.5 rounded-xl bg-teal-50 p-3 text-teal-600 hover:bg-teal-100 transition-colors"
        >
          <Phone size={20} />
          <span className="text-xs font-medium">שיחה</span>
        </a>
        <a
          href="https://wa.me/9720548018613"
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center gap-1.5 rounded-xl bg-green-50 p-3 text-green-600 hover:bg-green-100 transition-colors"
        >
          <MessageCircle size={20} />
          <span className="text-xs font-medium">WhatsApp</span>
        </a>
        <a
          href="mailto:info@odg.co.il"
          className="flex flex-col items-center gap-1.5 rounded-xl bg-blue-50 p-3 text-blue-600 hover:bg-blue-100 transition-colors"
        >
          <Mail size={20} />
          <span className="text-xs font-medium">מייל</span>
        </a>
      </div>
      <p className="text-xs text-gray-400 text-center mt-3">
        ירושלים: 054-8018613 | מרכז: 03-5098264
      </p>
    </div>
  )
}
