import { Phone, MessageCircle, Mail } from 'lucide-react'

export function ContactCard() {
  return (
    <div className="card-surface p-5">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">צור קשר עם הצוות</h3>
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
