import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { Heebo } from 'next/font/google'
import '@urban-renewal/design-system/src/globals.css'

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  variable: '--font-heebo',
  display: 'swap',
})

export const metadata: Metadata = {
  title: { template: '%s | OpenDoor', default: 'OpenDoor התחדשות עירונית' },
  description: 'ליווי מלא בפרויקטי התחדשות עירונית ופינוי-בינוי',
}

const rtlLocales = ['he', 'ar']

export default async function WebLayout({
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
    <html lang={locale} dir={dir} className={heebo.variable} suppressHydrationWarning>
      <body className="font-hebrew antialiased">
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
