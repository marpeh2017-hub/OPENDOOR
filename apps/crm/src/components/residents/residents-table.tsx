import Link from 'next/link'
import { Phone, MessageSquare, FileSignature, MoreHorizontal } from 'lucide-react'
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

type ResidentStatus = 'SIGNED' | 'INTERESTED' | 'UNDECIDED' | 'OBJECTING' | 'DECEASED'

const STATUS_CFG: Record<ResidentStatus, { label: string; cls: string }> = {
  SIGNED:      { label: 'חתם',       cls: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400' },
  INTERESTED:  { label: 'מעוניין',   cls: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400' },
  UNDECIDED:   { label: 'לא החליט',  cls: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400' },
  OBJECTING:   { label: 'מתנגד',     cls: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400' },
  DECEASED:    { label: 'נפטר',      cls: 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400' },
}

const RISK_CFG = {
  HIGH:   { label: 'גבוה',  cls: 'text-red-600' },
  MEDIUM: { label: 'בינוני', cls: 'text-amber-500' },
  LOW:    { label: 'נמוך',  cls: 'text-green-600' },
}

const mockResidents = [
  { id: 'r1', name: 'דוד כהן',      apt: '3/4',  project: 'הרצל 45, ת"א',    status: 'SIGNED'    as ResidentStatus, risk: 'LOW',    phone: '050-1234567', lastContact: 'לפני 2 ימים' },
  { id: 'r2', name: 'רחל לוי',      apt: '2/8',  project: 'הרצל 45, ת"א',    status: 'OBJECTING' as ResidentStatus, risk: 'HIGH',   phone: '052-9876543', lastContact: 'לפני שבוע' },
  { id: 'r3', name: 'משה ברג',      apt: '1/5',  project: 'ביאליק 12, ר"ג',  status: 'INTERESTED'as ResidentStatus, risk: 'MEDIUM', phone: '054-5551234', lastContact: 'היום' },
  { id: 'r4', name: 'שרה אברהם',    apt: '4/2',  project: 'הרצל 45, ת"א',    status: 'UNDECIDED' as ResidentStatus, risk: 'MEDIUM', phone: '053-4449876', lastContact: 'לפני 3 ימים' },
  { id: 'r5', name: 'יוסף שמואלי',  apt: '1/1',  project: 'בן יהודה 88, ת"א', status: 'SIGNED'   as ResidentStatus, risk: 'LOW',    phone: '050-3334444', lastContact: 'לפני 5 ימים' },
  { id: 'r6', name: 'מרים גולן',    apt: '2/11', project: 'ביאליק 12, ר"ג',  status: 'UNDECIDED' as ResidentStatus, risk: 'HIGH',   phone: '058-7778888', lastContact: 'לפני שבועיים' },
  { id: 'r7', name: 'אבי פרץ',      apt: '3/7',  project: 'בן יהודה 88, ת"א', status: 'SIGNED'   as ResidentStatus, risk: 'LOW',    phone: '052-1112222', lastContact: 'אתמול' },
  { id: 'r8', name: 'חנה וייס',     apt: '5/3',  project: 'הרצל 45, ת"א',    status: 'INTERESTED'as ResidentStatus, risk: 'LOW',    phone: '054-6667777', lastContact: 'לפני 4 ימים' },
]

export function ResidentsTable() {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="text-right font-semibold">דייר</TableHead>
          <TableHead className="text-right font-semibold">פרויקט / דירה</TableHead>
          <TableHead className="text-right font-semibold">סטטוס</TableHead>
          <TableHead className="text-right font-semibold">סיכון</TableHead>
          <TableHead className="text-right font-semibold">יצירת קשר אחרונה</TableHead>
          <TableHead className="w-24" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {mockResidents.map(resident => {
          const status = STATUS_CFG[resident.status]
          const risk = RISK_CFG[resident.risk as keyof typeof RISK_CFG]
          return (
            <TableRow key={resident.id} className="group cursor-pointer">
              <TableCell>
                <Link href={`/residents/${resident.id}`} className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="text-sm bg-primary/10 text-primary font-semibold">
                      {resident.name.slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                      {resident.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{resident.phone}</p>
                  </div>
                </Link>
              </TableCell>

              <TableCell>
                <p className="text-sm text-foreground">{resident.project}</p>
                <p className="text-xs text-muted-foreground">דירה {resident.apt}</p>
              </TableCell>

              <TableCell>
                <span className={cn(
                  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
                  status.cls
                )}>
                  {status.label}
                </span>
              </TableCell>

              <TableCell>
                <span className={cn('text-sm font-medium', risk.cls)}>{risk.label}</span>
              </TableCell>

              <TableCell>
                <span className="text-sm text-muted-foreground">{resident.lastContact}</span>
              </TableCell>

              <TableCell>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="התקשר">
                    <Phone size={13} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="הודעה">
                    <MessageSquare size={13} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="שלח לחתימה">
                    <FileSignature size={13} />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                        <MoreHorizontal size={13} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/residents/${resident.id}`}>צפייה בפרופיל</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem>עדכון סטטוס</DropdownMenuItem>
                      <DropdownMenuItem>הוספת הערה</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive">סמן כמתנגד</DropdownMenuItem>
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
