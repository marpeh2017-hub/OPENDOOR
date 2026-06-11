import Link from 'next/link'
import { ArrowLeft, Shield, CheckCircle2 } from 'lucide-react'

const trustBadges = [
  'מעל 50 פרויקטים פעילים',
  'מעל 10,000 דיירים מרוצים',
  'ירושלים ומרכז הארץ',
]

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-teal-50 via-white to-gray-50 py-20 lg:py-32">
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -start-40 h-96 w-96 rounded-full bg-teal-100/40 blur-3xl" />
        <div className="absolute -bottom-20 -end-20 h-64 w-64 rounded-full bg-teal-200/30 blur-2xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-4 py-1.5 text-sm font-medium text-teal-700">
            <Shield size={14} />
            המובילים בהתחדשות עירונית בישראל
          </div>

          {/* Headline */}
          <h1 className="mb-6 text-4xl font-black leading-tight text-gray-900 lg:text-6xl">
            פותחים את הדלת{' '}
            <span className="text-teal-500">להתחדשות עירונית</span>
            {' '}בטוחה, שקופה ומתקדמת
          </h1>

          {/* Sub */}
          <p className="mx-auto mb-8 max-w-2xl text-lg leading-relaxed text-gray-600">
            ליווי מלא של בעלי דירות ופרויקטים בהתחדשות עירונית – משלב ההתארגנות ועד קבלת המפתח לדירה החדשה.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10">
            <Link
              href="/contact"
              className="flex items-center gap-2 rounded-xl bg-teal-500 px-7 py-3.5 text-base font-semibold text-white shadow-teal hover:bg-teal-600 transition-all hover:shadow-lg"
            >
              קביעת פגישת ייעוץ
              <ArrowLeft size={18} />
            </Link>
            <Link
              href="/projects"
              className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-7 py-3.5 text-base font-semibold text-gray-700 hover:border-teal-300 hover:text-teal-600 transition-colors"
            >
              צפייה בפרויקטים
            </Link>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap items-center justify-center gap-4">
            {trustBadges.map((badge) => (
              <div key={badge} className="flex items-center gap-1.5 text-sm text-gray-500">
                <CheckCircle2 size={15} className="text-teal-500" />
                {badge}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
