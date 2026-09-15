'use client'

import { Phone, Mail, MapPin, Home, Users, AlertCircle, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CardSkeleton } from '@/components/ui/skeletons'
import { QueryError } from '@/components/ui/query-states'
import { useResident } from '@/hooks/use-residents'

const STATUS_LABELS: Record<string, string> = {
  SIGNED: 'חתם', INTERESTED: 'מעוניין', CONTACTED: 'נוצר קשר',
  UNDECIDED: 'לא החליט', OBJECTING: 'מתנגד',
  NOT_CONTACTED: 'לא נוצר קשר', UNREACHABLE: 'לא זמין',
}

const CHANNEL_LABELS: Record<string, string> = {
  WHATSAPP: 'וואטסאפ', SMS: 'SMS', EMAIL: 'אימייל', PHONE: 'טלפון',
}

function InfoRow({ icon: Icon, label, value, className }: {
  icon: React.ElementType
  label: string
  value: string
  className?: string
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon size={14} className="text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn('text-sm font-medium text-foreground mt-0.5 break-words', className)}>{value}</p>
      </div>
    </div>
  )
}

export function ResidentOverviewTab({ residentId }: { residentId: string }) {
  const { data: r, isLoading, isError, error, refetch } = useResident(residentId)

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} className="h-56" />)}
      </div>
    )
  }

  if (isError || !r) {
    return <QueryError message="שגיאה בטעינת פרטי הדייר" error={error} onRetry={() => refetch()} />
  }

  const apt      = r.apartment
  const building = apt?.building
  const project  = building?.complex?.project
  const lastSignature = r.signatures?.[0]

  const address = building
    ? `${building.address}${apt ? `, דירה ${apt.apartmentNumber}` : ''}${building.city ? `, ${building.city}` : ''}`
    : '—'

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Contact info — note: national ID is intentionally never displayed. */}
      <div className="card-surface p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">פרטי קשר</h3>
        <InfoRow icon={Phone} label="טלפון ראשי" value={r.phone ?? '—'} className="font-mono" />
        <InfoRow icon={Phone} label="טלפון נוסף" value={r.phone2 ?? '—'} className="font-mono" />
        <InfoRow icon={Mail}  label="אימייל"      value={r.email ?? '—'} />
        <InfoRow icon={MapPin} label="כתובת מגורים" value={address} />
        <InfoRow
          icon={MessageSquare}
          label="ערוץ מועדף"
          value={r.preferredChannel ? (CHANNEL_LABELS[r.preferredChannel] ?? r.preferredChannel) : '—'}
        />
      </div>

      {/* Apartment info */}
      <div className="card-surface p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">פרטי דירה</h3>
        <InfoRow
          icon={Home}
          label="קומה / מספר דירה"
          value={apt ? `${apt.floor != null ? `קומה ${apt.floor}, ` : ''}דירה ${apt.apartmentNumber}` : '—'}
        />
        <InfoRow icon={Home}  label="מספר חדרים" value={apt?.rooms != null ? `${apt.rooms} חדרים` : '—'} />
        <InfoRow icon={Home}  label="שטח"         value={apt?.sizeSqm != null ? `${apt.sizeSqm} מ"ר` : '—'} />
        <InfoRow
          icon={Users}
          label="אחוז בעלות"
          value={r.ownershipPercentage != null ? `${r.ownershipPercentage}%` : '—'}
        />
        <InfoRow icon={MapPin} label="פרויקט" value={project?.name ?? '—'} />
      </div>

      {/* Status + notes */}
      <div className="space-y-4">
        <div className="card-surface p-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">סטטוס חתימה</h3>
          <div className="flex items-center gap-2">
            <span className={cn(
              'inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold border',
              r.signatureStatus === 'SIGNED'
                ? 'bg-green-100 text-green-700 border-green-200'
                : r.signatureStatus === 'OBJECTING'
                  ? 'bg-red-100 text-red-700 border-red-200'
                  : 'bg-amber-100 text-amber-700 border-amber-200',
            )}>
              {STATUS_LABELS[r.signatureStatus] ?? r.signatureStatus}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            תאריך חתימה:{' '}
            <span className="text-foreground font-medium">
              {lastSignature?.signedAt
                ? new Date(lastSignature.signedAt).toLocaleDateString('he-IL')
                : '—'}
            </span>
          </p>
          {r.isObjecting && r.objectionReason && (
            <p className="text-sm text-red-600">סיבת התנגדות: {r.objectionReason}</p>
          )}
        </div>

        <div className="card-surface p-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2 flex items-center gap-2">
            <AlertCircle size={14} className="text-amber-500" /> הערות
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {r.notes?.trim() ? r.notes : 'אין הערות לדייר זה'}
          </p>
        </div>
      </div>
    </div>
  )
}
