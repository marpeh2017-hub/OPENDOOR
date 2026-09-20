'use client'

import { EmptyState } from '@/components/ui/query-states'

/**
 * NOT IMPLEMENTED — the API Gateway exposes no meetings endpoint. The Prisma
 * schema references a meeting (Task.meetingId) but no controller serves it, so
 * there is nothing real to fetch. Honest empty state instead of mock data.
 */
export function ResidentMeetingsTab({ residentId: _residentId }: { residentId: string }) {
  return (
    <div className="card-surface">
      <EmptyState
        message="ניהול פגישות אינו זמין עדיין"
        hint="פגישות מתועדות כרגע כמשימות מסוג פגישה"
      />
    </div>
  )
}
