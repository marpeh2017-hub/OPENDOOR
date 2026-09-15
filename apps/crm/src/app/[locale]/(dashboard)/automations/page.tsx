import { AutomationsPageContent } from '@/components/automations/automations-page-content'

export const metadata = { title: 'אוטומציות' }

/**
 * Automations.
 *
 * This screen previously stated that the feature was not implemented: the
 * `Automation` / `AutomationAction` models existed but the API exposed no
 * module. That is no longer true — `AutomationsController` backs every action
 * here, and `AutomationRunnerService` is called by the leads, residents,
 * projects, meetings and signatures modules.
 *
 * What is still not true, and is surfaced in the UI rather than hidden: several
 * triggers are not fired by anything yet, and `delayMinutes` is stored but not
 * honoured.
 */
export default function AutomationsPage() {
  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-foreground">אוטומציות</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            כללים שרצים אוטומטית כשמתרחש אירוע במערכת
          </p>
        </div>
      </div>

      <AutomationsPageContent />
    </div>
  )
}
