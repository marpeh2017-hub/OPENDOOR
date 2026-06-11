'use client'

import Link from 'next/link'
import { Shield, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

const navLinks = [
  { href: '/about',    label: 'אודות' },
  { href: '/services', label: 'שירותים' },
  { href: '/projects', label: 'פרויקטים' },
  { href: '/blog',     label: 'בלוג' },
  { href: '/faq',      label: 'שאלות נפוצות' },
  { href: '/contact',  label: 'צור קשר' },
]

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-white/90 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500">
            <Shield size={20} className="text-white" />
          </div>
          <div className="leading-tight">
            <span className="block text-sm font-bold text-gray-800">OpenDoor</span>
            <span className="block text-xs text-gray-500">התחדשות עירונית</span>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:text-teal-600 hover:bg-teal-50 transition-colors"
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/portal"
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:text-teal-600 border border-border hover:border-teal-200 transition-colors"
          >
            כניסת דיירים
          </Link>
          <Link
            href="/contact"
            className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-teal hover:bg-teal-600 transition-colors"
          >
            קביעת פגישה
          </Link>
        </div>

        {/* Mobile menu */}
        <button
          className="md:hidden flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Toggle menu"
        >
          {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile dropdown */}
      {isMenuOpen && (
        <div className="md:hidden border-t border-border bg-white px-4 pb-4">
          <nav className="flex flex-col gap-1 pt-3">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                onClick={() => setIsMenuOpen(false)}
              >
                {label}
              </Link>
            ))}
            <div className="mt-3 pt-3 border-t border-border flex flex-col gap-2">
              <Link href="/portal" className="rounded-lg border border-border px-4 py-2.5 text-center text-sm font-medium">
                כניסת דיירים
              </Link>
              <Link href="/contact" className="rounded-lg bg-teal-500 px-4 py-2.5 text-center text-sm font-semibold text-white">
                קביעת פגישה
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
