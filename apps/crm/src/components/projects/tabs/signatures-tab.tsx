import { Send, Eye, CheckCircle2, XCircle, Clock, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const STATUS_CONFIG = {
  SIGNED:   { label: 'חתם',       icon: CheckCircle2, cls: 'text-green-600 bg-green-50' },
  VIEWED:   { label: 'צפה',       icon: Eye,          cls: 'text-blue-600 bg-blue-50' },
  SENT:     { label: 'נשלח',      icon: Send,         cls: 'text-teal-600 bg-teal-50' },
  PENDING:  { label: 'ממתין',     icon: Clock,        cls: 'text-yellow-600 bg-yellow-50' },
  REJECTED: { label: 'סרב',       icon: XCircle,      cls: 'text-red-600 bg-red-50' },
  DRAFT:    { label: 'טיוטה',     icon: Clock,        cls: 'text-gray-500 bg-gray-50' },
} as const

const mockSigs = [
  { id: '1', resident: 'ישראל ישראלי', apt: '4',  sentAt: '01.03.2025', status: 'SIGNED',   signedAt: '05.03.2025' },
  { id: '2', resident: 'שרה כהן',      apt: '7',  sentAt: '01.03.2025', status: 'VIEWED',   signedAt: null },
  { id: '3', resident: 'מרים אברהם',   apt: '1',  sentAt: '01.03.2025', status: 'SIGNED',   signedAt: '03.03.2025' },
  { id: '4', resident: 'יוסי פרץ',     apt: '9',  sentAt: '10.03.2025', status: 'PENDING',  signedAt: null },
  { id: '5', resident: 'רחל גולן',     apt: '15', sentAt: '10.03.2025', status: 'SENT',     signedAt: null },
  { id: '6', resident: 'דוד לוי',      apt: '12', sentAt: null,         status: 'DRAFT',    signedAt: null },
]

export function ProjectSignaturesTab({ projectId }: { projectId: string }) {
  const counts = {
    SIGNED: mockSigs.filter(s => s.status === 'SIGNED').length,
    pending: mockSigs.filter(s => ['SENT','VIEWED','PENDING'].includes(s.status)).length,
    DRAFT: mockSigs.filter(s => s.status === 'DRAFT').length,
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card-surface p-4 text-center">
          <p className="text-2xl font-black text-green-600">{counts.SIGNED}</p>
          <p className="text-xs text-muted-foreground mt-1">חתמו</p>
        </div>
        <div className="card-surface p-4 text-center">
          <p className="text-2xl font-black text-teal-600">{counts.pending}</p>
          <p className="text-xs text-muted-foreground mt-1">ממתינים</p>
        </div>
        <div className="card-surface p-4 text-center">
          <p className="text-2xl font-black text-muted-foreground">{counts.DRAFT}</p>
          <p className="text-xs text-muted-foreground mt-1">טיוטות</p>
        </div>
      </div>

      {/* Table */}
      <div className="card-surface overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">מעקב חתימות</h3>
          <Button size="sm" className="bg-primary hover:bg-primary/90 gap-2 h-8">
            <Send size={13} /> שלח לכולם
          </Button>
        </div>
        <div className="divide-y divide-border">
          {mockSigs.map(sig => {
            const cfg = STATUS_CONFIG[sig.status as keyof typeof STATUS_CONFIG]
            const Icon = cfg.icon
            return (
              <div key={sig.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 group">
                <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0', cfg.cls)}>
                  <Icon size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{sig.resident}</p>
                  <p className="text-xs text-muted-foreground">דירה {sig.apt}{sig.sentAt ? ` · נשלח ${sig.sentAt}` : ''}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', cfg.cls)}>
                    {cfg.label}
                  </span>
                  {sig.status !== 'SIGNED' && sig.status !== 'DRAFT' && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" title="שלח תזכורת">
                      <RefreshCw size={13} />
                    </Button>
                  )}
                  {sig.status === 'DRAFT' && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs opacity-0 group-hover:opacity-100 gap-1.5">
                      <Send size={12} /> שלח
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
