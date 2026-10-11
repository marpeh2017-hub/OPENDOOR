'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useWebsiteForms } from '@/hooks/use-website-forms'
import { WebsiteFormStatusBadge } from './form-status'

/**
 * Buildings whose owners started the representation protocol on the website.
 * Each is also a lead (the person who started it is on the leads board), and
 * nobody's identity was checked, which the section says before anyone opens
 * one.
 */
export function WebsiteFormsSection({ locale }: { locale: string }) {
  const { data: forms, isLoading, error } = useWebsiteForms()

  return (
    <section aria-labelledby="website-forms-heading" className="space-y-3">
      <div>
        <h2 id="website-forms-heading" className="text-base font-semibold text-foreground">
          התחילו באתר
        </h2>
        <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
          בניינים שבעלי דירות התחילו בהם נציגות דרך האתר. מי שהתחיל מופיע גם בלוח הלידים. החתימות נאספו בקישור
          משותף, בלי אימות זהות.
        </p>
      </div>
      <div className="card-surface overflow-x-auto">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">טוען…</p>
        ) : error ? (
          <p role="alert" className="p-6 text-sm text-red-700">
            {error instanceof Error ? error.message : 'הרשימה לא נטענה'}
          </p>
        ) : !forms?.length ? (
          <p className="p-6 text-sm text-muted-foreground">עוד לא התחילו נציגות דרך האתר.</p>
        ) : (
          <table className="w-full min-w-[46rem] text-sm">
            <thead className="border-b border-border bg-gray-50 text-start text-xs text-gray-600">
              <tr>
                <th scope="col" className="px-4 py-3 text-start font-semibold">בניין</th>
                <th scope="col" className="px-4 py-3 text-start font-semibold">מי התחיל</th>
                <th scope="col" className="px-4 py-3 text-start font-semibold">חתמו</th>
                <th scope="col" className="px-4 py-3 text-start font-semibold">סטטוס</th>
                <th scope="col" className="px-4 py-3 text-start font-semibold">התחיל ב־</th>
                <th scope="col" className="px-4 py-3 text-start font-semibold">
                  <span className="sr-only">פעולות</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {forms.map((form) => (
                <tr key={form.id} className="align-middle">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-foreground">{form.compoundName}</p>
                    {form.address !== form.compoundName && (
                      <p className="text-xs text-muted-foreground">{form.address}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-foreground">{form.initiator?.fullName ?? '—'}</p>
                    {form.initiator?.phone && (
                      <a href={`tel:${form.initiator.phone}`} dir="ltr" className="text-xs text-teal-700 hover:underline">
                        {form.initiator.phone}
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3 text-foreground">{form.signatures}</td>
                  <td className="px-4 py-3">
                    <WebsiteFormStatusBadge status={form.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(form.createdAt).toLocaleDateString('he-IL')}
                  </td>
                  <td className="px-4 py-3 text-end">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/${locale}/forms/website/${form.id}`}>צפייה</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
