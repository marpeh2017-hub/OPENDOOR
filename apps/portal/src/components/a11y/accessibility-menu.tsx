'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Accessibility, Check, X } from 'lucide-react'
import {
  A11Y_TOGGLES, DEFAULT_A11Y, applyA11y, readA11y, saveA11y, type A11yPrefs, type A11yToggle,
} from './a11y-prefs'

const TEXT_LEVELS = [0, 1, 2] as const

type Copy = {
  open: string; title: string; close: string; textSize: string
  sizes: [string, string, string]; glyphs: [string, string, string]
  toggles: Record<A11yToggle, string>; reset: string; statement: string
}

/** The website's wording (apps/website/messages, "a11y"); Russian and Arabic
 *  readers get the Hebrew, as with the legal pages. */
const COPY: Record<'he' | 'en', Copy> = {
  he: {
    open: 'תפריט נגישות', title: 'תפריט נגישות', close: 'סגירת תפריט הנגישות', textSize: 'גודל טקסט',
    sizes: ['גודל טקסט רגיל', 'גודל טקסט גדול', 'גודל טקסט גדול מאוד'], glyphs: ['א', 'א+', 'א++'],
    toggles: {
      contrast: 'ניגודיות גבוהה', links: 'הדגשת קישורים', font: 'גופן קריא', spacing: 'ריווח שורות', motion: 'עצירת אנימציות',
    },
    reset: 'איפוס', statement: 'הצהרת הנגישות',
  },
  en: {
    open: 'Accessibility menu', title: 'Accessibility menu', close: 'Close the accessibility menu', textSize: 'Text size',
    sizes: ['Normal text size', 'Large text size', 'Extra large text size'], glyphs: ['A', 'A+', 'A++'],
    toggles: {
      contrast: 'High contrast', links: 'Highlight links', font: 'Readable font', spacing: 'Line spacing', motion: 'Stop animations',
    },
    reset: 'Reset', statement: 'Accessibility statement',
  },
}

/**
 * The accessibility menu in the personal area: the website's menu
 * (apps/website/src/components/a11y/accessibility-menu.tsx), with the same
 * adjustments, stylesheet and storage, so it behaves the same in both.
 *
 * Fixed to the bottom left, clear of the chat on the right; on the screens
 * with the bottom navigation the shared stylesheet lifts it above the bar
 * ([data-a11y-fab]). The statement lives on the website, which covers the
 * personal area too.
 */
export function AccessibilityMenu({ locale, statementHref }: { locale: string; statementHref: string }) {
  const copy = COPY[locale === 'en' ? 'en' : 'he']
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
    // dir="ltr" on the wrapper only, so the button stays pinned to the left
    // edge when the panel opens and widens the column; the panel carries the
    // reading direction.
    <div
      data-a11y-fab
      dir="ltr"
      className="fixed left-4 z-40 flex flex-col items-start bottom-[max(1rem,env(safe-area-inset-bottom))] sm:left-6 print:hidden"
    >
      {open && (
        <div
          ref={panel}
          id={`${id}-panel`}
          dir={locale === 'en' ? 'ltr' : 'rtl'}
          role="dialog"
          aria-labelledby={`${id}-title`}
          className="mb-3 max-h-[calc(100dvh-8rem)] w-[min(19rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-4 shadow-xl"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 id={`${id}-title`} ref={heading} tabIndex={-1} className="text-lg font-bold text-gray-900 focus:outline-none">
              {copy.title}
            </h2>
            <button
              type="button"
              onClick={close}
              aria-label={copy.close}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>

          <div className="mt-3">
            <p id={`${id}-size`} className="text-sm font-semibold text-gray-800">{copy.textSize}</p>
            <div role="group" aria-labelledby={`${id}-size`} className="mt-2 grid grid-cols-3 gap-2">
              {TEXT_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  aria-pressed={prefs.text === level}
                  onClick={() => update({ ...prefs, text: level })}
                  className={`min-h-11 rounded-lg border-2 font-bold ${prefs.text === level ? pressed : idle}`}
                >
                  <span aria-hidden="true" style={{ fontSize: `${1 + level * 0.15}rem` }}>{copy.glyphs[level]}</span>
                  <span className="sr-only">{copy.sizes[level]}</span>
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
                  className={`flex min-h-11 w-full items-center gap-3 rounded-lg border-2 px-3 text-start text-sm font-semibold ${prefs[key] ? pressed : idle}`}
                >
                  <span
                    aria-hidden="true"
                    className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 ${prefs[key] ? 'border-teal-700 bg-teal-700 text-white' : 'border-gray-400'}`}
                  >
                    {prefs[key] && <Check size={14} strokeWidth={3} />}
                  </span>
                  {copy.toggles[key]}
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 pt-3">
            <button
              type="button"
              onClick={() => update(DEFAULT_A11Y)}
              className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-teal-700 hover:bg-teal-50"
            >
              {copy.reset}
            </button>
            <a
              href={statementHref}
              className="inline-flex min-h-11 items-center px-1 text-sm font-semibold text-teal-700 underline underline-offset-2"
            >
              {copy.statement}
            </a>
          </div>
        </div>
      )}

      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={open ? `${id}-panel` : undefined}
        aria-label={copy.open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-teal-700 text-white shadow-lg transition hover:bg-teal-800"
      >
        <Accessibility size={26} aria-hidden="true" />
      </button>
    </div>
  )
}
