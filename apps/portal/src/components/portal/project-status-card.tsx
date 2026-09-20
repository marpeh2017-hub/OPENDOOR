import { CheckCircle2 } from 'lucide-react'
import type { Dashboard } from '@/lib/dashboard'

/**
 * The project's real position, on the real scale.
 *
 * This card used to hold seven invented stages. `ProjectStage` has twelve, and
 * a resident comparing the portal's "5 of 7" with anything the project team
 * said would have been comparing two different scales.
 */
export function ProjectStatusCard({
  project, buildingAddress,
}: {
  project: Dashboard['project']
  buildingAddress: string
}) {
  return (
    <div className="card-surface p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-gray-800">{buildingAddress}</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            שלב נוכחי: <span className="text-teal-600 font-medium">{project.stageLabel}</span>
          </p>
        </div>
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
          project.status === 'ACTIVE'
            ? 'bg-teal-50 text-teal-700'
            : 'bg-gray-100 text-gray-600'
        }`}>
          {STATUS_LABELS[project.status] ?? project.status}
        </span>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-400 mb-1.5">
          <span>התקדמות כוללת</span>
          <span>{project.progressPercent}%</span>
        </div>
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-2 rounded-full bg-teal-500 transition-all"
            style={{ width: `${project.progressPercent}%` }}
          />
        </div>
      </div>

      {/* Twelve stages do not fit a phone, so the row scrolls rather than shrinking
          each step until the labels are unreadable. */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {project.stages.map((stage, i) => (
          <div key={stage.key} className="flex items-center gap-1 flex-shrink-0">
            <div className="flex flex-col items-center gap-1">
              <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                stage.done
                  ? 'bg-teal-500 text-white'
                  : stage.current
                  ? 'bg-teal-100 text-teal-600 ring-2 ring-teal-500'
                  : 'bg-gray-100 text-gray-400'
              }`}>
                {stage.done ? <CheckCircle2 size={14} /> : i + 1}
              </div>
              <span className={`text-xs whitespace-nowrap ${
                stage.current ? 'text-teal-600 font-medium' : 'text-gray-500'
              }`}>
                {stage.label}
              </span>
            </div>
            {i < project.stages.length - 1 && (
              <div className={`h-0.5 w-6 flex-shrink-0 mb-4 rounded ${stage.done ? 'bg-teal-400' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'פעיל',
  ON_HOLD: 'מושהה',
  COMPLETED: 'הושלם',
  CANCELLED: 'בוטל',
  ARCHIVED: 'בארכיון',
}
