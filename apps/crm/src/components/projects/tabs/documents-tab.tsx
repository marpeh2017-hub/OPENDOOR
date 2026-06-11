import { FileText, Upload, Download, Eye, Trash2, File, FileCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const CATEGORY_LABELS: Record<string, string> = {
  CONTRACT:          'חוזה',
  LAND_REGISTRY:     'רישום קרקע',
  PLANNING:          'תכנון',
  ENGINEERING:       'הנדסה',
  MUNICIPALITY:      'עירייה',
  LEGAL:             'משפטי',
  POWER_OF_ATTORNEY: 'ייפוי כוח',
  MEETING_MINUTES:   'פרוטוקול',
}

const mockDocs = [
  { id: '1', name: 'הסכם פינוי-בינוי ראשי',    category: 'CONTRACT',      date: '15.03.2025', size: '2.4 MB', status: 'APPROVED' },
  { id: '2', name: 'נסח טאבו – כל הדירות',     category: 'LAND_REGISTRY', date: '10.01.2025', size: '850 KB', status: 'APPROVED' },
  { id: '3', name: 'תוכנית קומה טיפוסית',      category: 'PLANNING',      date: '01.06.2025', size: '8.1 MB', status: 'PENDING_REVIEW' },
  { id: '4', name: 'חוות דעת מהנדס',           category: 'ENGINEERING',   date: '20.05.2025', size: '1.2 MB', status: 'APPROVED' },
  { id: '5', name: 'אישור ועדת תכנון',          category: 'MUNICIPALITY',  date: '05.06.2025', size: '420 KB', status: 'DRAFT' },
  { id: '6', name: 'ייפוי כוח כולל',            category: 'POWER_OF_ATTORNEY', date: '12.02.2025', size: '650 KB', status: 'APPROVED' },
]

const STATUS_CLS = {
  APPROVED:       'text-green-700 bg-green-50 border-green-200',
  PENDING_REVIEW: 'text-yellow-700 bg-yellow-50 border-yellow-200',
  DRAFT:          'text-gray-600 bg-gray-50 border-gray-200',
  REJECTED:       'text-red-700 bg-red-50 border-red-200',
}
const STATUS_LABEL = {
  APPROVED:       'מאושר',
  PENDING_REVIEW: 'בבדיקה',
  DRAFT:          'טיוטה',
  REJECTED:       'נדחה',
}

export function ProjectDocumentsTab({ projectId }: { projectId: string }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{mockDocs.length} מסמכים</p>
        <Button size="sm" variant="outline" className="gap-2 h-8">
          <Upload size={13} /> העלה מסמך
        </Button>
      </div>

      <div className="card-surface divide-y divide-border overflow-hidden">
        {mockDocs.map(doc => {
          const status = STATUS_LABEL[doc.status as keyof typeof STATUS_LABEL]
          const statusCls = STATUS_CLS[doc.status as keyof typeof STATUS_CLS]
          return (
            <div key={doc.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/20 group">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
                <FileText size={16} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground">
                    {CATEGORY_LABELS[doc.category] ?? doc.category}
                  </span>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="text-xs text-muted-foreground">{doc.date}</span>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="text-xs text-muted-foreground">{doc.size}</span>
                </div>
              </div>
              <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full border', statusCls)}>
                {status}
              </span>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-7 w-7" title="צפה">
                  <Eye size={13} />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" title="הורד">
                  <Download size={13} />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" title="מחק">
                  <Trash2 size={13} />
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
