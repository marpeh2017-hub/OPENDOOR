import Link from 'next/link'
import { MoreHorizontal, ArrowUpRight } from 'lucide-react'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

const STAGE_LABELS: Record<string, string> = {
  DISCOVERY:             'גילוי',
  FEASIBILITY:           'היתכנות',
  RESIDENT_ORGANIZATION: 'התארגנות',
  SIGNATURES:            'חתימות',
  DEVELOPER_SELECTION:   'בחירת יזם',
  PLANNING:              'תכנון',
  MUNICIPAL_APPROVAL:    'אישור עירוני',
  PERMIT:                'היתר',
  EVACUATION:            'פינוי',
  CONSTRUCTION:          'בנייה',
  DELIVERY:              'מסירה',
  POST_DELIVERY:         'לאחר מסירה',
}

const STAGE_VARIANT: Record<string, string> = {
  SIGNATURES:   'bg-purple-100 text-purple-700 border-purple-200',
  CONSTRUCTION: 'bg-green-100 text-green-700 border-green-200',
  PLANNING:     'bg-cyan-100 text-cyan-700 border-cyan-200',
  DELIVERY:     'bg-teal-100 text-teal-700 border-teal-200',
  EVACUATION:   'bg-orange-100 text-orange-700 border-orange-200',
  PERMIT:       'bg-blue-100 text-blue-700 border-blue-200',
}

const mockProjects = [
  { id: '1', code: 'TLV-001', name: 'רחוב הרצל 45',      city: 'תל אביב',   stage: 'SIGNATURES',   residents: 48,  signed: 34,  status: 'ACTIVE' },
  { id: '2', code: 'HFA-003', name: 'שד׳ בן גוריון 12',  city: 'חיפה',      stage: 'CONSTRUCTION', residents: 120, signed: 113, status: 'ACTIVE' },
  { id: '3', code: 'JLM-007', name: 'רחוב ויצמן 8',      city: 'ירושלים',   stage: 'PLANNING',     residents: 65,  signed: 54,  status: 'ACTIVE' },
  { id: '4', code: 'BNB-002', name: 'שד׳ הנביאים 22',    city: 'בני ברק',   stage: 'EVACUATION',   residents: 33,  signed: 30,  status: 'ACTIVE' },
  { id: '5', code: 'TLV-008', name: 'שד׳ רוטשילד 7',     city: 'תל אביב',   stage: 'DELIVERY',     residents: 90,  signed: 90,  status: 'ACTIVE' },
  { id: '6', code: 'JLM-011', name: 'רחוב יפו 112',      city: 'ירושלים',   stage: 'SIGNATURES',   residents: 72,  signed: 38,  status: 'ACTIVE' },
  { id: '7', code: 'TLV-004', name: 'רחוב דיזנגוף 85',   city: 'תל אביב',   stage: 'PERMIT',       residents: 56,  signed: 51,  status: 'ON_HOLD' },
]

export async function ProjectsTable() {
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/40 hover:bg-muted/40">
          <TableHead className="text-right font-semibold text-xs uppercase tracking-wide text-muted-foreground w-24">קוד</TableHead>
          <TableHead className="text-right font-semibold text-xs uppercase tracking-wide text-muted-foreground">פרויקט</TableHead>
          <TableHead className="text-right font-semibold text-xs uppercase tracking-wide text-muted-foreground">עיר</TableHead>
          <TableHead className="text-right font-semibold text-xs uppercase tracking-wide text-muted-foreground">שלב</TableHead>
          <TableHead className="text-right font-semibold text-xs uppercase tracking-wide text-muted-foreground w-48">חתימות</TableHead>
          <TableHead className="text-right font-semibold text-xs uppercase tracking-wide text-muted-foreground w-20">דיירים</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {mockProjects.map(p => {
          const pct = Math.round((p.signed / p.residents) * 100)
          return (
            <TableRow key={p.id} className="group cursor-pointer hover:bg-muted/30">
              <TableCell className="font-mono text-xs text-muted-foreground">{p.code}</TableCell>
              <TableCell>
                <Link href={`/projects/${p.id}`} className="font-medium text-foreground hover:text-primary transition-colors group-hover:underline">
                  {p.name}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">{p.city}</TableCell>
              <TableCell>
                <span className={cn(
                  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border',
                  STAGE_VARIANT[p.stage] ?? 'bg-muted text-muted-foreground border-border',
                )}>
                  {STAGE_LABELS[p.stage]}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2.5">
                  <Progress value={pct} className="h-1.5 flex-1" />
                  <span className={cn(
                    'text-xs font-semibold tabular-nums w-10 text-left',
                    pct >= 80 ? 'text-green-600' : pct >= 51 ? 'text-primary' : 'text-orange-600',
                  )}>
                    {pct}%
                  </span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {p.signed}/{p.residents}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm text-center">{p.residents}</TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                      <MoreHorizontal size={16} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem asChild>
                      <Link href={`/projects/${p.id}`} className="gap-2">
                        <ArrowUpRight size={14} /> פתח פרויקט
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem>ערוך</DropdownMenuItem>
                    <DropdownMenuItem>דוח חתימות</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive">ארכיון</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
