import { Phone, Mail, MapPin, Calendar, Home, Users, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const mockResident = {
  name: 'דוד כהן',
  phone: '050-1234567',
  altPhone: '03-6543210',
  email: 'david@example.com',
  idNumber: '123456789',
  birthYear: '1958',
  address: 'הרצל 45 דירה 4, תל אביב',
  apt: { floor: 3, number: 4, rooms: 3, sqm: 78 },
  ownership: 'בעלים רשום',
  project: 'הרצל 45, תל אביב',
  status: 'SIGNED',
  signatureDate: '15.03.2024',
  notes: 'דייר ותיק ומשתף פעולה. ביצע שיפוץ עצמי ב-2019, יש לוודא תיאום עם עו"ד לגבי שינויים בנכס.',
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
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn('text-sm font-medium text-foreground mt-0.5', className)}>{value}</p>
      </div>
    </div>
  )
}

export function ResidentOverviewTab({ residentId }: { residentId: string }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Contact info */}
      <div className="card-surface p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">פרטי קשר</h3>
        <InfoRow icon={Phone}   label="טלפון ראשי"     value={mockResident.phone} />
        <InfoRow icon={Phone}   label="טלפון נוסף"     value={mockResident.altPhone} />
        <InfoRow icon={Mail}    label="אימייל"          value={mockResident.email} />
        <InfoRow icon={MapPin}  label="כתובת מגורים"   value={mockResident.address} />
        <InfoRow icon={Calendar}label="שנת לידה"        value={mockResident.birthYear} />
      </div>

      {/* Apartment info */}
      <div className="card-surface p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">פרטי דירה</h3>
        <InfoRow icon={Home}  label="קומה / מספר דירה"  value={`קומה ${mockResident.apt.floor}, דירה ${mockResident.apt.number}`} />
        <InfoRow icon={Home}  label="מספר חדרים"         value={`${mockResident.apt.rooms} חדרים`} />
        <InfoRow icon={Home}  label="שטח"                value={`${mockResident.apt.sqm} מ"ר`} />
        <InfoRow icon={Users} label="סוג בעלות"          value={mockResident.ownership} />
        <InfoRow icon={MapPin}label="פרויקט"             value={mockResident.project} />
      </div>

      {/* Status + notes */}
      <div className="space-y-4">
        <div className="card-surface p-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">סטטוס חתימה</h3>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold bg-green-100 text-green-700 border border-green-200">
              חתם ✓
            </span>
          </div>
          <p className="text-sm text-muted-foreground">תאריך חתימה: <span className="text-foreground font-medium">{mockResident.signatureDate}</span></p>
        </div>

        <div className="card-surface p-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2 flex items-center gap-2">
            <AlertCircle size={14} className="text-amber-500" /> הערות
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{mockResident.notes}</p>
        </div>
      </div>
    </div>
  )
}
