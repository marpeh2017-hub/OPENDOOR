'use client'

import { useLocale } from 'next-intl'
import { usePathname } from '@/i18n/navigation'
import { FaqChatWidget } from './faq-chat-widget'

/**
 * Site-wide mount point for the FAQ chat widget.
 *
 * Lives in the root locale layout so it follows the visitor across every
 * page, not just /faq — but stays off the legal pages, where a sales-facing
 * "talk to us" widget floating over the terms of service reads as pressure
 * rather than help.
 *
 * `usePathname` here is next-intl's locale-stripped version (`@/i18n/navigation`),
 * so `pathname` is `/privacy`, never `/he/privacy` — one check works for
 * every locale without a prefix strip of its own.
 */
const EXCLUDED_PATHS = ['/privacy', '/terms', '/accessibility']

export function SiteChatWidget() {
  const locale = useLocale()
  const pathname = usePathname()

  if (locale !== 'he') return null
  if (EXCLUDED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return null
  }

  return <FaqChatWidget />
}
