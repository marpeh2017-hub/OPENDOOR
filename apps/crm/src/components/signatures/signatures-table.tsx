import { Send, RefreshCw, Eye, MoreHorizontal, CheckCircle2, Clock, AlertCircle, Circle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

type SigStatus = 'SIGNED' | 'SENT' | 'OPENED' | 'EXPIRED' | 'NOT_SENT'

const STATUS_CFG: Record<SigStatus, { label: string; icon: React.ElementType; cls: string; badge: string }> = {
  SIGNED:   { label: 'חתם',       icon: CheckCircle2, cls: 'text-green-600', badge: 'bg-green-100 text-green-700 border-green-200' },
  SENT:     { label: 'נשלח',      icon: Clock,        cls: 'text-blue-500',  badge: 'bg-blue-100 text-blue-700 border-blue-200' },
  OPENED:   { label: 'נפתח',      icon: Eye,          cls: 'text-purple-500',badge: 'bg-purple-100 text-purple-700 border-purple-200' },
  EXPIRED:  { label: 'פג תוקף',   icon: AlertCircle,  cls: 'text-red-600',   badge: 'bg-red-100 text-red-700 border-red-200' },
  NOT_SENT: { label: 'לא נשלח',   icon: Circle,       cls: 'text-gray-400',  badge: 'bg-gray-100 text-gray-500 border-gray-200' },
}

const mockSignatures = [
  { id: 's1',  name: 'דוד כהן',     apt: '3/4',  project: 'הרצל 45, ת"א',    status: 'SIGNED'   as SigStatus, sentDate: '01.03.2024', signedDate: '15.03.2024', reminders: 1, assignee: 'אבי ש׳' },
  { id: 's2',  name: 'רחל לוי',     apt: '2/8',  project: 'הרצל 45, ת"א',    status: 'EXPIRED'  as SigStatus, sentDate: '01.03.2024', signedDate: null,          reminders: 3, assignee: 'שרה מ׳' },
  { id: 's3',  name: 'משה ברג',     apt: '1/5',  project: 'ביאליק 12, ר"ג',  status: 'OPENED'   as SigStatus, sentDate: '10.03.2024', signedDate: null,          reminders: 0, assignee: 'אבי ש׳' },
  { id: 's4',  name: 'שרה אברהם',   apt: '4/2',  project: 'הרצל 45, ת"א',    status: 'SENT'     as SigStatus, sentDate: '20.03.2024', signedDate: null,          reminders: 0, assignee: 'שרה מ׳' },
  { id: 's5',  name: 'יוסף שמואלי', apt: '1/1',  project: 'בן יהודה 88, ת"א', status: 'SIGNED'  as SigStatus, sentDate: '05.02.2024', signedDate: '18.02.2024', reminders: 0, assignee: 'אבי ש׳' },
  { id: 's6',  name: 'מרים גולן',   apt: '2/11', project: 'ביאליק 12, ר"ג',  status: 'NOT_SENT' as SigStatus, sentDate: null,          signedDate: null,          reminders: 0, assignee: 'שרה מ׳' },
  { id: 's7',  name: 'אבי פרץ',     apt: '3/7',  project: 'בן יהודה 88, ת"א', status: 'SIGNED'  as SigStatus, sentDate: '15.01.2024', signedDate: '28.01.2024', reminders: 1, assignee: 'אבי ש׳' },
  { id: 's8',  name: 'חנה וייס',    apt: '5/3',  project: 'הרצל 45, ת"א',    status: 'SENT'     as SigStatus, sentDate: '25.03.2024', signedDate: null,          reminders: 0, assignee: 'שרה מ׳' },
]

export function SignaturesTable() {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="text-right font-semibold">דייר</TableHead>
          <TableHead className="text-right font-semibold">פרויקט / דירה</TableHead>
          <TableHead className="text-right font-semibold">סטטוס</TableHead>
          <TableHead className="text-right font-semibold">תאריך שליחה</TableHead>
          <TableHead className="text-right font-semibold">תאריך חתימה</TableHead>
          <TableHead className="text-right font-semibold">תזכורות</TableHead>
          <TableHead className="w-32" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {mockSignatures.map(sig => {
          const status = STATUS_CFG[sig.status]
          const StatusIcon = status.icon
          return (
            <TableRow key={sig.id} className="group">
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                      {sig.name.slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-foreground">{sig.name}</p>
                    <p className="text-xs text-muted-foreground">{sig.assignee}</p>
                  </div>
                </div>
              </TableCell>

              <TableCell>
                <p className="text-sm text-foreground">{sig.project}</p>
                <p className="text-xs text-muted-foreground">דירה {sig.apt}</p>
              </TableCell>

              <TableCell>
                <div className="flex items-center gap-1.5">
                  <StatusIcon size={14} className={status.cls} />
                  <span className={cn(
                    'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
                    status.badge
                  )}>
                    {status.label}
                  </span>
                </div>
              </TableCell>

              <TableCell>
                <span className="text-sm text-muted-foreground">
                  {sig.sentDate ?? '—'}
                </span>
              </TableCell>

              <TableCell>
                <span className={cn(
                  'text-sm font-medium',
                  sig.signedDate ? 'text-green-600' : 'text-muted-foreground'
                )}>
                  {sig.signedDate ?? '—'}
                </span>
              </TableCell>

              <TableCell>
                {sig.reminders > 0
                  ? <span className="text-sm text-muted-foreground">{sig.reminders} ×</span>
                  : <span className="text-sm text-muted-foreground">—</span>
                }
              </TableCell>

              <TableCell>
                <div className="flex items-center gap-1 justify-end">
                  {(sig.status === 'NOT_SENT') && (
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                      <Send size={11} /> שלח
                    </Button>
                  )}
                  {(sig.status === 'SENT' || sig.status === 'OPENED' || sig.status === 'EXPIRED') && (
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                      <RefreshCw size={11} /> תזכורת
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100">
                        <MoreHorizontal size={13} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>צפייה בבקשה</DropdownMenuItem>
                      <DropdownMenuItem>העתקת קישור</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive">ביטול בקשה</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
