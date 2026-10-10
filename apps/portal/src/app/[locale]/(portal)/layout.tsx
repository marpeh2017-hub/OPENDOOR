import Image from 'next/image'
import { Phone } from 'lucide-react'
import { BottomNav } from '@/components/layout/bottom-nav'
import { ChatWidget } from '@/components/portal/chat-widget'

export default function PortalDashboardLayout({ children }: { children: React.ReactNode }) {
  // The page's own bottom padding clears the fixed bottom nav. The nav grows by
  // the home-indicator inset, so this has to grow with it or the last card ends
  // up underneath a taller nav.
  //
  // The header is min-h-14 rather than h-14: the inset is added as padding, and
  // a fixed height under border-box would shrink the content row by exactly the
  // inset instead of letting the header grow past the Dynamic Island. Raw env()
  // with no max(), so a phone without a cutout keeps the original 56px header.
  return (
    <div className="min-h-screen bg-gray-50 pb-[calc(5rem+env(safe-area-inset-bottom))] print:min-h-0 print:bg-white print:pb-0">
      <header className="sticky top-0 z-10 bg-white border-b border-border px-4 min-h-14 pt-[env(safe-area-inset-top)] flex items-center justify-between print:hidden">
        <div className="flex items-center gap-2.5">
          <Image src="/brand/opendoor-icon-512.png" alt="" width={32} height={32} className="h-8 w-8" />
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-bold text-gray-800">האזור האישי</span>
            <span className="text-xs text-gray-500">OpenDoor Group</span>
          </span>
        </div>
        <a
          href="tel:+972548018613"
          dir="ltr"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-semibold text-teal-700"
        >
          <Phone size={16} aria-hidden="true" />
          054-8018613
        </a>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-5 print:max-w-none print:p-0">
        {children}
      </main>

      {/* On paper only the page prints: a signed copy, not the app around it. */}
      <div className="print:hidden">
        <ChatWidget />
        <BottomNav />
      </div>
    </div>
  )
}
