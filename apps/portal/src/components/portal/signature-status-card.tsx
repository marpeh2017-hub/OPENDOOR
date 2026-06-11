import { FileSignature, CheckCircle2, Clock } from 'lucide-react'

export function SignatureStatusCard() {
  const isSigned = true // fetch from API

  return (
    <div className={`card-surface p-5 border-2 ${isSigned ? 'border-success-500/30' : 'border-teal-200'}`}>
      <div className="flex items-center gap-3">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${isSigned ? 'bg-success-50' : 'bg-teal-50'}`}>
          {isSigned
            ? <CheckCircle2 size={22} className="text-success-600" />
            : <Clock size={22} className="text-teal-500" />
          }
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-800">
            {isSigned ? 'חתמת על ההסכם' : 'ממתין לחתימה'}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {isSigned
              ? 'תאריך חתימה: 15 במרץ 2025'
              : 'נא לחתום על הסכם הפינוי-בינוי בהקדם'
            }
          </p>
        </div>
        {!isSigned && (
          <button className="me-auto flex-shrink-0 rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-teal hover:bg-teal-600 transition-colors">
            לחתימה
          </button>
        )}
      </div>
    </div>
  )
}
