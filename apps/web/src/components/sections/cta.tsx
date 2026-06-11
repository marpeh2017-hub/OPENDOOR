import Link from 'next/link'
import { ArrowLeft, Shield } from 'lucide-react'

export function CtaSection() {
  return (
    <section className="py-20 bg-teal-500">
      <div className="mx-auto max-w-4xl px-4 lg:px-8 text-center">
        <Shield size={48} className="mx-auto text-teal-200 mb-6" />
        <h2 className="text-3xl font-black text-white mb-4">
          מוכנים לפתוח את הדלת לדירה החדשה שלכם?
        </h2>
        <p className="text-lg text-teal-100 mb-8 max-w-xl mx-auto">
          צרו קשר עוד היום לייעוץ ראשוני חינם. נבדוק את הפוטנציאל של הנכס שלכם.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/contact"
            className="flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-base font-semibold text-teal-600 hover:bg-teal-50 transition-colors"
          >
            קביעת פגישת ייעוץ
            <ArrowLeft size={18} />
          </Link>
          <a
            href="tel:054-8018613"
            className="flex items-center gap-2 rounded-xl border-2 border-teal-300 px-7 py-3.5 text-base font-semibold text-white hover:bg-teal-400 transition-colors"
          >
            054-8018613
          </a>
        </div>
      </div>
    </section>
  )
}
