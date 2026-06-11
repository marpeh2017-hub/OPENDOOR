import type { Metadata } from 'next'
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
