import { Phone, Mail, MapPin, MessageCircle } from 'lucide-react'
import { ContactForm } from './contact-form'

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
          <ContactForm />
        </div>
      </div>
    </section>
  )
}
