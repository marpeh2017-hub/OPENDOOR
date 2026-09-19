import Link from 'next/link'

const footerLinks = {
  'מוצר': [
    { label: 'ניהול בעלים',   href: '#product' },
    { label: 'חתימות דיגיטליות', href: '#product' },
    { label: 'דשבורד פרויקט', href: '#product' },
    { label: 'פורטל דיירים',  href: '#solutions' },
  ],
  'חברה': [
    { label: 'אבטחה',         href: '#security' },
    { label: 'צור קשר',       href: '#contact' },
    { label: 'תנאי שימוש',    href: '/terms' },
    { label: 'מדיניות פרטיות', href: '/privacy' },
  ],
}

export function Footer() {
  return (
    <footer className="border-t border-gray-100 bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{ background: '#2F9DA0' }}
              >
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M10 2L3 6v8l7 4 7-4V6l-7-4z" stroke="white" strokeWidth="1.5" fill="none" strokeLinejoin="round"/>
                  <path d="M10 8v6M7 11h6" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800">OpenDoor</p>
                <p className="text-xs text-gray-500">התחדשות עירונית</p>
              </div>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed max-w-xs">
              פתיחות, ביטחון ושקיפות לאורך כל תהליך ההתחדשות העירונית.
            </p>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">{title}</h4>
              <ul className="space-y-2">
                {links.map(({ label, href }) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className="text-sm text-gray-500 hover:text-teal-600 transition-colors"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400">
          <p>© {new Date().getFullYear()} OpenDoor התחדשות עירונית. כל הזכויות שמורות.</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-teal-600 transition-colors">פרטיות</Link>
            <Link href="/terms" className="hover:text-teal-600 transition-colors">תנאים</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
