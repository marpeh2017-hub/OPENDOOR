import { Phone, Mail, MapPin, MessageCircle } from 'lucide-react'

export function ContactSection() {
  return (
    <section id="contact" className="py-20 bg-white">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          {/* Info */}
          <div>
            <h2 className="text-3xl font-black text-gray-900 mb-3">צור קשר</h2>
            <p className="text-gray-600 mb-8">
              נשמח לענות על כל שאלה ולסייע בכל נושא הקשור להתחדשות עירונית.
            </p>

            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">
                  סניף ירושלים (ראשי)
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2.5 text-sm text-gray-600">
                    <MapPin size={16} className="text-teal-500 flex-shrink-0" />
                    נחום חפצדי 17, מגדלי רם, ירושלים
                  </div>
                  <a href="tel:054-8018613" className="flex items-center gap-2.5 text-sm text-gray-600 hover:text-teal-600">
                    <Phone size={16} className="text-teal-500 flex-shrink-0" />
                    054-8018613
                  </a>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">
                  סניף מרכז
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2.5 text-sm text-gray-600">
                    <MapPin size={16} className="text-teal-500 flex-shrink-0" />
                    מגדלי בסר 3, רחוב מצדה 9, בני ברק
                  </div>
                  <a href="tel:03-5098264" className="flex items-center gap-2.5 text-sm text-gray-600 hover:text-teal-600">
                    <Phone size={16} className="text-teal-500 flex-shrink-0" />
                    03-5098264
                  </a>
                </div>
              </div>

              <div className="space-y-2">
                <a href="mailto:info@odg.co.il" className="flex items-center gap-2.5 text-sm text-gray-600 hover:text-teal-600">
                  <Mail size={16} className="text-teal-500 flex-shrink-0" />
                  info@odg.co.il
                </a>
                <a
                  href="https://wa.me/9720548018613"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 text-sm text-gray-600 hover:text-green-600"
                >
                  <MessageCircle size={16} className="text-green-500 flex-shrink-0" />
                  שלחו לנו WhatsApp
                </a>
              </div>
            </div>
          </div>

          {/* Lead Form */}
          <div className="card-surface p-8">
            <h3 className="text-lg font-bold text-gray-800 mb-5">השאר פרטים וניצור קשר</h3>
            <form className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">שם פרטי</label>
                  <input type="text" className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="ישראל" />
                </div>
                <div>
                  <label className="form-label">שם משפחה</label>
                  <input type="text" className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="ישראלי" />
                </div>
              </div>
              <div>
                <label className="form-label">טלפון</label>
                <input type="tel" dir="ltr" className="w-full rounded-lg border border-border px-3 py-2.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="050-0000000" />
              </div>
              <div>
                <label className="form-label">כתובת הנכס</label>
                <input type="text" className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="רחוב, מספר, עיר" />
              </div>
              <div>
                <label className="form-label">הודעה (אופציונלי)</label>
                <textarea rows={3} className="w-full rounded-lg border border-border px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="ספרו לנו על הנכס שלכם..." />
              </div>
              <button
                type="submit"
                className="w-full rounded-lg bg-teal-500 py-3 text-sm font-semibold text-white shadow-teal hover:bg-teal-600 transition-colors"
              >
                שלח פרטים
              </button>
              <p className="text-xs text-gray-400 text-center">
                הפרטים שלך שמורים אצלנו ולא יועברו לצד שלישי
              </p>
            </form>
          </div>
        </div>
      </div>
    </section>
  )
}
