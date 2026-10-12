'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Accessibility, Check, X } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import {
  A11Y_TOGGLES, DEFAULT_A11Y, applyA11y, readA11y, saveA11y, type A11yPrefs,
} from './a11y-prefs'

const TEXT_LEVELS = [0, 1, 2] as const

/**
 * The accessibility menu: a round button in the end corner (left in Hebrew),
 * above the chat button where the chat shows (globals.css, "The end corner"),
 * that opens a small panel of adjustments. Not the start corner: a button
 * there sits over the start of every line it passes, as the chat once did
 * over the footer's phone number. Approved 2026-10-12 as drawn: text size, high
 * contrast, highlighted links, readable font, line spacing, stopping
 * animations, reset, and the accessibility statement.
 *
 * It is an addition, not the accessibility itself: the pages meet the
 * standard without it (see /accessibility). Built in rather than a third-
 * party widget, which would load an outside script the privacy policy says
 * the site does not load. Choices stay in the visitor's browser.
 *
 * A non-modal dialog: focus moves to its heading on opening, Escape or the
 * close button returns it to the menu button, and a click outside closes it.
 * Each adjustment is a toggle button announcing its state (aria-pressed).
 */
export function AccessibilityMenu() {
  const t = useTranslations('a11y')
  const endIsLeft = useLocale() === 'he'
  const [open, setOpen] = useState(false)
  const [prefs, setPrefs] = useState<A11yPrefs>(DEFAULT_A11Y)
  const id = useId()
  const button = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)

  // The boot script already applied the stored choice; this shows it.
  useEffect(() => setPrefs(readA11y()), [])

  useEffect(() => {
    if (!open) return
    heading.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      button.current?.focus()
    }
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node
      if (!panel.current?.contains(target) && !button.current?.contains(target)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [open])

  function update(next: A11yPrefs) {
    setPrefs(next)
    applyA11y(next)
    saveA11y(next)
  }

  function close() {
    setOpen(false)
    button.current?.focus()
  }

  const pressed = 'border-teal-700 bg-teal-50 text-teal-900'
  const idle = 'border-gray-300 bg-white text-gray-800 hover:border-teal-600'

  return (
    // z-[44]: under the chat (45), whose open panel covers this button rather
    // than the other way round; both under the mobile nav drawer (50).
    <div
      data-a11y-fab-site
      className={`fixed z-[44] flex flex-col items-end print:hidden ${
        endIsLeft
          ? 'left-[max(1rem,env(safe-area-inset-left))] sm:left-[max(1.5rem,env(safe-area-inset-left))]'
          : 'right-[max(1rem,env(safe-area-inset-right))] sm:right-[max(1.5rem,env(safe-area-inset-right))]'
      }`}
    >
      {open && (
        <div
          ref={panel}
          id={`${id}-panel`}
          role="dialog"
          aria-labelledby={`${id}-title`}
          className="mb-3 max-h-[calc(100dvh-7rem)] w-[min(19rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-4 shadow-xl"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 id={`${id}-title`} ref={heading} tabIndex={-1} className="type-h3 font-bold text-gray-900 focus:outline-none">
              {t('title')}
            </h2>
            <button
              type="button"
              onClick={close}
              aria-label={t('close')}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>

          <div className="mt-3">
            <p id={`${id}-size`} className="type-small font-semibold text-gray-800">{t('textSize')}</p>
            <div role="group" aria-labelledby={`${id}-size`} className="mt-2 grid grid-cols-3 gap-2">
              {TEXT_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  aria-pressed={prefs.text === level}
                  onClick={() => update({ ...prefs, text: level })}
                  className={`min-h-11 rounded-lg border-2 font-bold ${prefs.text === level ? pressed : idle}`}
                >
                  <span aria-hidden="true" style={{ fontSize: `${1 + level * 0.15}rem` }}>{t(`textSizeGlyph${level}`)}</span>
                  <span className="sr-only">{t(`textSize${level}`)}</span>
                </button>
              ))}
            </div>
          </div>

          <ul className="mt-3 space-y-2">
            {A11Y_TOGGLES.map((key) => (
              <li key={key}>
                <button
                  type="button"
                  aria-pressed={prefs[key]}
                  onClick={() => update({ ...prefs, [key]: !prefs[key] })}
                  className={`flex min-h-11 w-full items-center gap-3 rounded-lg border-2 px-3 text-start type-small font-semibold ${prefs[key] ? pressed : idle}`}
                >
                  <span
                    aria-hidden="true"
                    className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 ${prefs[key] ? 'border-teal-700 bg-teal-700 text-white' : 'border-gray-400'}`}
                  >
                    {prefs[key] && <Check size={14} strokeWidth={3} />}
                  </span>
                  {t(key)}
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 pt-3">
            <button
              type="button"
              onClick={() => update(DEFAULT_A11Y)}
              className="inline-flex min-h-11 items-center rounded-lg px-3 type-small font-semibold text-teal-700 hover:bg-teal-50"
            >
              {t('reset')}
            </button>
            <Link
              href="/accessibility"
              onClick={() => setOpen(false)}
              className="inline-flex min-h-11 items-center px-1 type-small font-semibold text-teal-700 underline underline-offset-2"
            >
              {t('statement')}
            </Link>
          </div>
        </div>
      )}

      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={open ? `${id}-panel` : undefined}
        aria-label={t('open')}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-teal-700 text-white shadow-lg transition hover:bg-teal-800"
      >
        <Accessibility size={26} aria-hidden="true" />
      </button>
    </div>
  )
}
