import Link from 'next/link'
import { MoreHorizontal, Phone, MessageSquare, FileSignature } from 'lucide-react'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

const STATUS_CONFIG = {
  SIGNED:        { label: 'חתם',           className: 'bg-green-100 text-green-700 border-green-200' },
  INTERESTED:    { label: 'מעוניין',        className: 'bg-blue-100 text-blue-700 border-blue-200' },
  CONTACTED:     { label: 'נוצר קשר',      className: 'bg-teal-100 text-teal-700 border-teal-200' },
  UNDECIDED:     { label: 'מתלבט',         className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  OBJECTING:     { label: 'מתנגד',         className: 'bg-red-100 text-red-700 border-red-200' },
  NOT_CONTACTED: { label: 'לא נוצר קשר',  className: 'bg-gray-100 text-gray-600 border-gray-200' },
  UNREACHABLE:   { label: 'לא זמין',       className: 'bg-orange-100 text-orange-700 border-orange-200' },
} as const

const mockResidents = [
  { id: '1', name: 'ישראל ישראלי',  apt: '4',  floor: 2, phone: '050-1234567', status: 'SIGNED',        risk: 10 },
  { id: '2', name: 'שרה כהן',       apt: '7',  floor: 3, phone: '052-9876543', status: 'INTERESTED',    risk: 25 },
  { id: '3', name: 'דוד לוי',       apt: '12', floor: 4, phone: '054-5551234', status: 'OBJECTING',     risk: 85 },
  { id: '4', name: 'מרים אברהם',    apt: '1',  floor: 1, phone: '053-1112233', status: 'SIGNED',        risk: 5  },
  { id: '5', name: 'יוסי פרץ',      apt: '9',  floor: 3, phone: '050-4445566', status: 'NOT_CONTACTED', risk: 50 },
  { id: '6', name: 'רחל גולן',      apt: '15', floor: 5, phone: '058-7778899', status: 'UNDECIDED',     risk: 60 },
  { id: '7', name: 'אבי שפירא',     apt: '3',  floor: 1, phone: '054-3334455', status: 'CONTACTED',     risk: 30 },
]

function RiskBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full', score >= 70 ? 'bg-red-500' : score >= 40 ? 'bg-orange-400' : 'bg-green-500')}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">{score}</span>
    </div>
  )
}

export function ProjectResidentsTab({ projectId }: { projectId: string }) {
  return (
    <div className="card-surface overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">דייר</TableHead>
            <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">דירה</TableHead>
            <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">טלפון</TableHead>
            <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">סטטוס</TableHead>
            <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">סיכון</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {mockResidents.map(r => {
            const status = STATUS_CONFIG[r.status as keyof typeof STATUS_CONFIG]
            return (
              <TableRow key={r.id} className="group hover:bg-muted/20">
                <TableCell>
                  <Link href={`/residents/${r.id}`} className="font-medium text-foreground hover:text-primary">
                    {r.name}
                  </Link>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  דירה {r.apt} · קומה {r.floor}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground font-mono" dir="ltr">{r.phone}</TableCell>
                <TableCell>
                  <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border', status.className)}>
                    {status.label}
                  </span>
                </TableCell>
                <TableCell><RiskBar score={r.risk} /></TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="שיחה">
                      <Phone size={13} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="WhatsApp">
                      <MessageSquare size={13} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="חתימה">
                      <FileSignature size={13} />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
