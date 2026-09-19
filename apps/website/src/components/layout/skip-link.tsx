import { getTranslations } from 'next-intl/server'

/**
 * Skip link — the first focusable element on every page.
 *
 * WCAG 2.4.1. Without it a keyboard or screen-reader user tabs through the
 * entire navigation on every single page before reaching content.
 *
 * Visually hidden until focused, using `top` rather than `display: none`:
 * a hidden-by-display element is not focusable at all, which is the usual way
 * a skip link is implemented and silently does nothing. The `.skip-link` class
 * lives in the shared globals.css so the behaviour is defined once.
 */
export async function SkipLink() {
  const t = await getTranslations('nav')
  return (
    <a href="#main-content" className="skip-link">
      {t('skipToContent')}
    </a>
  )
}
