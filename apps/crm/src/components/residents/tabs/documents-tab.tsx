import { FileText, Eye, Download, CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type DocStatus = 'RECEIVED' | 'PENDING' | 'MISSING'

const STATUS_CFG: Record<DocStatus, { label: string; icon: React.ElementType; cls: string }> = {
  RECEIVED: { label: 'התקבל', icon: CheckCircle2, cls: 'text-green-600' },
  PENDING:  { label: 'ממתין', icon: Clock,        cls: 'text-amber-500' },
  MISSING:  { label: 'חסר',   icon: AlertCircle,  cls: 'text-red-600'  },
}

const mockDocs = [
  { id: '1', name: 'נסח טאבו',                  category: 'רשומות',      status: 'RECEIVED' as DocStatus, date: '14.02.2024', size: '1.2 MB' },
  { id: '2', name: 'צילום ת.ז + ספח',           category: 'זיהוי',       status: 'RECEIVED' as DocStatus, date: '10.01.2024', size: '0.8 MB' },
  { id: '3', name: 'הסכם פינוי-בינוי חתום',     category: 'הסכמים',      status: 'RECEIVED' as DocStatus, date: '15.03.2024', size: '3.4 MB' },
  { id: '4', name: 'ייפוי כוח נוטריוני',         category: 'ייפוי כוח',  status: 'PENDING'  as DocStatus, date: null,         size: null },
  { id: '5', name: 'אישור עירייה – ארנונה',      category: 'אישורים',     status: 'MISSING'  as DocStatus, date: null,         size: null },
]

export function ResidentDocumentsTab({ residentId }: { residentId: string }) {
  return (
    <div className="card-surface divide-y divide-border overflow-hidden">
      {mockDocs.map(doc => {
        const status = STATUS_CFG[doc.status]
        const StatusIcon = status.icon
        return (
          <div key={doc.id} className="flex items-center gap-4 px-4 py-3.5 hover:bg-muted/20">
            <div className="h-9 w-9 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
              <FileText size={16} className="text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{doc.name}</p>
              <p className="text-xs text-muted-foreground">{doc.category}{doc.date ? ` · ${doc.date}` : ''}{doc.size ? ` · ${doc.size}` : ''}</p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="flex items-center gap-1.5">
                <StatusIcon size={14} className={status.cls} />
                <span className={cn('text-xs font-medium', status.cls)}>{status.label}</span>
              </div>
              {doc.status === 'RECEIVED' && (
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                    <Eye size={13} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                    <Download size={13} />
                  </Button>
                </div>
              )}
              {doc.status !== 'RECEIVED' && (
                <Button variant="outline" size="sm" className="h-7 text-xs">
                  {doc.status === 'PENDING' ? 'הזכרה' : 'בקשת מסמך'}
                </Button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
