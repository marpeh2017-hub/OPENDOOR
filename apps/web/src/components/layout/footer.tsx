import { Link } from '@/i18n/routing'
import { Shield } from 'lucide-react'
import { company } from '@/lib/company'
import { CONTACT_ANCHOR } from '@/lib/links'

// The 'שירותים' column and the אודות/פרויקטים/בלוג entries were removed: those
// routes do not exist and every link in them returned a 404. Add a column back
// only together with the pages it points at.
const footerLinks = {
  'חברה': [
    { label: 'צור קשר', href: CONTACT_ANCHOR },
  ],
  'משפטי': [
    { label: 'תנאי שימוש',     href: '/terms' },
    { label: 'מדיניות פרטיות', href: '/privacy' },
    { label: 'נגישות',         href: '/accessibility' },
  ],
}

export function Footer() {
  return (
    <footer className="border-t border-border bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500">
                <Shield size={18} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800">OpenDoor</p>
                <p className="text-xs text-gray-500">התחדשות עירונית</p>
              </div>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed">
              פתיחות, ביטחון ושקיפות לאורך כל תהליך ההתחדשות העירונית.
            </p>
            <p className="text-xs text-gray-600 mt-3">
              <a href="https://odg.co.il" className="underline hover:text-teal-700">odg.co.il</a>
            </p>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}</h3>
              <ul className="space-y-2">
                {links.map(({ label, href }) => (
                  <li key={href}>
                    <Link href={href} className="text-sm text-gray-600 hover:text-teal-700 transition-colors">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-600">
          <p>
            © {new Date().getFullYear()} {company.legalName} (ח.פ. {company.registrationNumber}).
            כל הזכויות שמורות.
          </p>
          <p>ירושלים: 054-8018613 | מרכז: 03-5098264</p>
        </div>
      </div>
    </footer>
  )
}
