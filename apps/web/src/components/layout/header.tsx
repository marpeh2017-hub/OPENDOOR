'use client'

import Link from 'next/link'
import { useState } from 'react'

const navLinks = [
  { href: '#product',  label: 'מוצר' },
  { href: '#solutions',label: 'פתרונות' },
  { href: '#security', label: 'אבטחה' },
  { href: '#contact',  label: 'צור קשר' },
]

export function Header() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-100 bg-white/95 backdrop-blur-sm shadow-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: '#2F9DA0' }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 2L3 6v8l7 4 7-4V6l-7-4z" stroke="white" strokeWidth="1.5" fill="none" strokeLinejoin="round"/>
              <path d="M10 8v6M7 11h6" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="leading-tight">
            <span className="block text-sm font-bold text-gray-900">OpenDoor</span>
            <span className="block text-xs text-gray-500">התחדשות עירונית</span>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:text-teal-600 hover:bg-teal-50 transition-colors"
            >
              {label}
            </a>
          ))}
        </nav>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3">
          <a
            href="#contact"
            className="rounded-lg px-5 py-2 text-sm font-semibold text-white transition-colors"
            style={{ background: '#2F9DA0' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#22797D')}
            onMouseLeave={e => (e.currentTarget.style.background = '#2F9DA0')}
          >
            בקש הדגמה
          </a>
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          )}
        </button>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 pb-4">
          <nav className="flex flex-col gap-1 pt-3">
            {navLinks.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                onClick={() => setOpen(false)}
              >
                {label}
              </a>
            ))}
            <div className="mt-3 pt-3 border-t border-gray-100">
              <a
                href="#contact"
                className="block rounded-lg px-4 py-2.5 text-center text-sm font-semibold text-white"
                style={{ background: '#2F9DA0' }}
                onClick={() => setOpen(false)}
              >
                בקש הדגמה
              </a>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
