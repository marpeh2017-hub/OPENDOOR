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
    <div className="min-h-screen bg-gray-50 pb-[calc(5rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-10 bg-white border-b border-border px-4 min-h-14 pt-[env(safe-area-inset-top)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-500">
            <span className="text-xs font-bold text-white">OD</span>
          </div>
          <span className="text-sm font-semibold text-gray-800">OpenDoor</span>
        </div>
        <span className="text-xs text-gray-500">ירושלים 054-8018613</span>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-5">
        {children}
      </main>

      <ChatWidget />
      <BottomNav />
    </div>
  )
}
