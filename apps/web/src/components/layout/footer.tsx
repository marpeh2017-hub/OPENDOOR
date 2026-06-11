import Link from 'next/link'
import { Shield } from 'lucide-react'

const footerLinks = {
  'שירותים': [
    { label: 'התחדשות עירונית', href: '/services/urban-renewal' },
    { label: 'פינוי-בינוי',      href: '/services/evacuation' },
    { label: 'ייצוג דיירים',    href: '/services/representation' },
    { label: 'ארגון דיירים',     href: '/services/organization' },
  ],
  'חברה': [
    { label: 'אודות',      href: '/about' },
    { label: 'פרויקטים',   href: '/projects' },
    { label: 'בלוג',       href: '/blog' },
    { label: 'צור קשר',    href: '/contact' },
  ],
  'משפטי': [
    { label: 'תנאי שימוש',   href: '/terms' },
    { label: 'מדיניות פרטיות', href: '/privacy' },
    { label: 'נגישות',       href: '/accessibility' },
  ],
}

export function Footer() {
  return (
    <footer className="border-t border-border bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
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
            <p className="text-xs text-gray-400 mt-3">
              <a href="https://odg.co.il" className="hover:text-teal-500">odg.co.il</a>
            </p>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">{title}</h4>
              <ul className="space-y-2">
                {links.map(({ label, href }) => (
                  <li key={href}>
                    <Link href={href} className="text-sm text-gray-500 hover:text-teal-600 transition-colors">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400">
          <p>© {new Date().getFullYear()} OpenDoor התחדשות עירונית. כל הזכויות שמורות.</p>
          <p>ירושלים: 054-8018613 | מרכז: 03-5098264</p>
        </div>
      </div>
    </footer>
  )
}
