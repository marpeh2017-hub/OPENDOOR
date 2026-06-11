import { Shield, Eye, Zap, Users, FileCheck, HeadphonesIcon } from 'lucide-react'

const benefits = [
  {
    icon: Shield,
    title: 'בטיחות ואמינות',
    desc: 'עו"ד מומחים לליווי משפטי מלא, הגנה על זכויות הדיירים בכל שלב.',
  },
  {
    icon: Eye,
    title: 'שקיפות מלאה',
    desc: 'פורטל דיירים דיגיטלי לעדכונים בזמן אמת על התקדמות הפרויקט.',
  },
  {
    icon: Zap,
    title: 'תהליך יעיל',
    desc: 'מטכנולוגיה מתקדמת ועד ניסיון שטח – מזרזים את כל שלבי הפרויקט.',
  },
  {
    icon: Users,
    title: 'ליווי אישי',
    desc: 'נציג ייעודי לכל פרויקט, זמין לדיירים בכל שאלה ובכל שלב.',
  },
  {
    icon: FileCheck,
    title: 'ניהול מסמכים',
    desc: 'כל החתימות, ההסכמים והמסמכים המשפטיים במקום אחד, מאובטח.',
  },
  {
    icon: HeadphonesIcon,
    title: 'תמיכה מתמשכת',
    desc: 'אנחנו לצדך גם לאחר קבלת המפתח, לכל שאלה ובעיה שתעלה.',
  },
]

export function BenefitsSection() {
  return (
    <section className="py-20 bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-black text-gray-900 mb-3">
            למה OpenDoor?
          </h2>
          <p className="text-lg text-gray-600 max-w-xl mx-auto">
            אנחנו לא סתם חברת התחדשות עירונית. אנחנו שותפים שלך לאורך כל הדרך.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {benefits.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="card-surface p-6 hover:shadow-lg transition-shadow">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 mb-4">
                <Icon size={24} className="text-teal-500" />
              </div>
              <h3 className="text-base font-semibold text-gray-800 mb-2">{title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
