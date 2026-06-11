import { BottomNav } from '@/components/layout/bottom-nav'

export default function PortalDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="sticky top-0 z-10 bg-white border-b border-border px-4 h-14 flex items-center justify-between">
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

      <BottomNav />
    </div>
  )
}
