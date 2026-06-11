import { FileText, Download, Eye, CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

type DocStatus = 'RECEIVED' | 'PENDING' | 'REQUIRED'

const STATUS_CFG: Record<DocStatus, { label: string; icon: React.ElementType; cls: string; badge: string }> = {
  RECEIVED: { label: 'הועלה',  icon: CheckCircle2, cls: 'text-green-600', badge: 'bg-green-50 text-green-700' },
  PENDING:  { label: 'ממתין',  icon: Clock,        cls: 'text-amber-500', badge: 'bg-amber-50 text-amber-700' },
  REQUIRED: { label: 'נדרש',   icon: AlertCircle,  cls: 'text-red-500',   badge: 'bg-red-50 text-red-700'   },
}

const CATEGORIES = [
  {
    name: 'מסמכי זהות',
    docs: [
      { id: '1', name: 'צילום תעודת זהות + ספח', status: 'RECEIVED' as DocStatus, date: '10.01.2024' },
      { id: '2', name: 'תמונת פספורט',            status: 'PENDING'  as DocStatus, date: null },
    ],
  },
  {
    name: 'מסמכי נכס',
    docs: [
      { id: '3', name: 'נסח טאבו',                status: 'RECEIVED' as DocStatus, date: '14.02.2024' },
      { id: '4', name: 'חשבון ארנונה עדכני',       status: 'REQUIRED' as DocStatus, date: null },
    ],
  },
  {
    name: 'הסכמים',
    docs: [
      { id: '5', name: 'הסכם פינוי-בינוי חתום',   status: 'RECEIVED' as DocStatus, date: '15.03.2024' },
      { id: '6', name: 'ייפוי כוח נוטריוני',       status: 'REQUIRED' as DocStatus, date: null },
    ],
  },
]

export default function DocumentsPage() {
  return (
    <div className="space-y-5 pb-10">
      <div>
        <h1 className="text-xl font-bold text-gray-800">המסמכים שלי</h1>
        <p className="text-sm text-gray-500">כל המסמכים הקשורים לפרויקט הרצל 45</p>
      </div>

      {/* Summary chips */}
      <div className="flex gap-2 flex-wrap">
        {[
          { label: '3 הועלו',  cls: 'bg-green-50 text-green-700' },
          { label: '1 ממתין',  cls: 'bg-amber-50 text-amber-700' },
          { label: '2 נדרשים', cls: 'bg-red-50 text-red-700' },
        ].map(c => (
          <span key={c.label} className={cn('text-xs font-medium px-3 py-1 rounded-full', c.cls)}>
            {c.label}
          </span>
        ))}
      </div>

      {CATEGORIES.map(cat => (
        <div key={cat.name} className="card-surface overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-gray-50/50">
            <h2 className="text-sm font-semibold text-gray-700">{cat.name}</h2>
          </div>
          <div className="divide-y divide-border">
            {cat.docs.map(doc => {
              const cfg = STATUS_CFG[doc.status]
              const StatusIcon = cfg.icon
              return (
                <div key={doc.id} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <FileText size={16} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{doc.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <StatusIcon size={11} className={cfg.cls} />
                      <span className={cn('text-xs font-medium', cfg.cls)}>{cfg.label}</span>
                      {doc.date && <span className="text-xs text-gray-400">{doc.date}</span>}
                    </div>
                  </div>
                  {doc.status === 'RECEIVED'
                    ? (
                      <div className="flex gap-1 flex-shrink-0">
                        <button className="h-8 w-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">
                          <Eye size={14} />
                        </button>
                        <button className="h-8 w-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">
                          <Download size={14} />
                        </button>
                      </div>
                    )
                    : (
                      <button className="text-xs font-medium bg-teal-500 text-white px-3 py-1.5 rounded-lg hover:bg-teal-600 transition-colors flex-shrink-0">
                        העלה
                      </button>
                    )
                  }
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
