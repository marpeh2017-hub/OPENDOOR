import type { Metadata, Viewport } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { ThemeProvider } from 'next-themes'
import { Heebo, Assistant } from 'next/font/google'
import { Toaster } from 'sonner'
import '@urban-renewal/design-system/src/globals.css'

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  variable: '--font-heebo',
  display: 'swap',
})

const assistant = Assistant({
  subsets: ['hebrew', 'latin'],
  variable: '--font-assistant',
  display: 'swap',
})

/**
 * `viewport-fit=cover` is what makes `env(safe-area-inset-*)` mean anything —
 * without it the browser keeps the page inside the safe area and every inset
 * resolves to 0.
 *
 * It matters more here than on the marketing site: residents live in this app
 * on a phone, and the bottom navigation sits exactly where the home indicator
 * is.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: {
    template: '%s | OpenDoor – פורטל דיירים',
    default: 'OpenDoor – פורטל דיירים',
  },
  description: 'הפורטל האישי שלך לפרויקט ההתחדשות העירונית – OpenDoor',
}

const rtlLocales = ['he', 'ar']

export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const messages = await getMessages()
  const dir = rtlLocales.includes(locale) ? 'rtl' : 'ltr'

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${heebo.variable} ${assistant.variable}`}
      suppressHydrationWarning
    >
      <body className="font-hebrew antialiased bg-gray-50">
        <ThemeProvider attribute="class" defaultTheme="light">
          <NextIntlClientProvider messages={messages}>
            {children}
            <Toaster
              position={dir === 'rtl' ? 'bottom-right' : 'bottom-left'}
              richColors
              closeButton
            />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
