import { CheckCircle2 } from 'lucide-react'

const stages = [
  { key: 'ORGANIZATION',  label: 'התארגנות',   done: true },
  { key: 'SIGNATURES',    label: 'חתימות',      done: true },
  { key: 'DEVELOPER',     label: 'בחירת יזם',   done: true },
  { key: 'PLANNING',      label: 'תכנון',        done: false, active: true },
  { key: 'PERMIT',        label: 'היתר',         done: false },
  { key: 'CONSTRUCTION',  label: 'בנייה',        done: false },
  { key: 'DELIVERY',      label: 'מסירה',        done: false },
]

export function ProjectStatusCard() {
  const activeIdx = stages.findIndex((s) => s.active)

  return (
    <div className="card-surface p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-gray-800">רחוב הרצל 45, תל אביב</h2>
          <p className="text-xs text-gray-500 mt-0.5">שלב נוכחי: <span className="text-teal-600 font-medium">תכנון</span></p>
        </div>
        <span className="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-700">
          פעיל
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-400 mb-1.5">
          <span>התקדמות כוללת</span>
          <span>{Math.round(((activeIdx + 1) / stages.length) * 100)}%</span>
        </div>
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-2 rounded-full bg-teal-500 transition-all"
            style={{ width: `${Math.round(((activeIdx + 1) / stages.length) * 100)}%` }}
          />
        </div>
      </div>

      {/* Stage stepper */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {stages.map((stage, i) => (
          <div key={stage.key} className="flex items-center gap-1 flex-shrink-0">
            <div className="flex flex-col items-center gap-1">
              <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                stage.done
                  ? 'bg-teal-500 text-white'
                  : stage.active
                  ? 'bg-teal-100 text-teal-600 ring-2 ring-teal-500'
                  : 'bg-gray-100 text-gray-400'
              }`}>
                {stage.done ? <CheckCircle2 size={14} /> : i + 1}
              </div>
              <span className="text-xs text-gray-500 whitespace-nowrap">{stage.label}</span>
            </div>
            {i < stages.length - 1 && (
              <div className={`h-0.5 w-6 flex-shrink-0 mb-4 rounded ${stage.done ? 'bg-teal-400' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
