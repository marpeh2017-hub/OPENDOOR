import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getLocale } from 'next-intl/server'
import { ThemeProvider } from 'next-themes'
import { Heebo, Assistant } from 'next/font/google'
import { Toaster } from 'sonner'
import { QueryProvider } from '@/components/providers/query-provider'
import '@/app/globals.css'

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

export const metadata: Metadata = {
  title: {
    template: '%s | OpenDoor CRM',
    default: 'OpenDoor CRM – ניהול פרויקטי התחדשות עירונית',
  },
  description: 'מערכת ניהול מתקדמת לחברות התחדשות עירונית – OpenDoor התחדשות עירונית',
  icons: { icon: '/favicon.ico' },
}

const rtlLocales = ['he', 'ar']

export default async function RootLayout({
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
      <body className="font-hebrew antialiased">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <NextIntlClientProvider messages={messages}>
            <QueryProvider>
              {children}
              <Toaster
                position={dir === 'rtl' ? 'bottom-right' : 'bottom-left'}
                richColors
                closeButton
              />
            </QueryProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
