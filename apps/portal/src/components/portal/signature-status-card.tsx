import { CheckCircle2, Clock, AlertTriangle } from 'lucide-react'
import type { Dashboard } from '@/lib/dashboard'
import { formatDate } from '@/lib/dashboard'

/**
 * Where this resident stands on signing.
 *
 * Three states, not two. The mock had signed / not signed; the database also
 * records an objection, and showing an objecting resident a cheerful "please
 * sign soon" is the portal telling them their position was not registered.
 */
export function SignatureStatusCard({ signature }: { signature: Dashboard['signature'] }) {
  if (signature.isObjecting || signature.status === 'OBJECTING') {
    return (
      <div className="card-surface p-5 border-2 border-amber-200">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50">
            <AlertTriangle size={22} className="text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">רשמנו את התנגדותך</p>
            <p className="text-xs text-gray-500 mt-0.5">
              צוות הפרויקט יצור איתך קשר. ניתן לפנות אלינו בכל שאלה.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (signature.signed) {
    return (
      <div className="card-surface p-5 border-2 border-success-500/30">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-success-50">
            <CheckCircle2 size={22} className="text-success-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">חתמת על ההסכם</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {/* Only shown when a date is actually recorded. A signature noted
                  on paper has no e-signature timestamp, and inventing one would
                  put a false date in front of the person it concerns. */}
              {signature.signedAt ? `תאריך חתימה: ${formatDate(signature.signedAt)}` : 'החתימה נקלטה במערכת'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card-surface p-5 border-2 border-teal-200">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50">
          <Clock size={22} className="text-teal-500" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-800">ממתין לחתימה</p>
          <p className="text-xs text-gray-500 mt-0.5 truncate">
            {signature.pending?.documentTitle
              ? `לחתימה: ${signature.pending.documentTitle}`
              : 'טרם נשלח אליך מסמך לחתימה'}
          </p>
        </div>
      </div>
    </div>
  )
}
