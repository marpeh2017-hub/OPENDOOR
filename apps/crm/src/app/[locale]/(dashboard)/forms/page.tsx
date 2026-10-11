'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { FileCheck2, Lock, Plus } from 'lucide-react'
import { PROTOCOL_CLAUSE_COUNT, REPRESENTATION_PROTOCOL } from '@urban-renewal/api-contracts'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useForms, type FormListItem } from '@/hooks/use-forms'
import { FormStatusBadge } from '@/components/forms/form-status'
import { WebsiteFormsSection } from '@/components/forms/website-forms-section'

/**
 * Forms: the templates the company can send, and the forms on their way to
 * the last signature. One template today, the representation-appointment
 * protocol, whose wording is locked: staff fill in the meeting, never the
 * text. Below them, the protocols owners started on the website for
 * buildings that are not yet projects.
 */
export default function FormsPage() {
  const { locale } = useParams<{ locale: string }>()
  const { data: forms, isLoading, error } = useForms()

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-foreground">טפסים</h1>
          <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
            טפסים לחתימה דיגיטלית של בעלי הדירות: יוצרים טופס לפרויקט, שולחים לכל הבעלים, ועוקבים עד
            החתימה האחרונה. כל החתימות מתאחדות למסמך אחד.
          </p>
        </div>
        <Button size="sm" className="gap-2" asChild>
          <Link href={`/${locale}/forms/new`}>
            <Plus size={15} aria-hidden="true" />
            טופס חדש לפרויקט
          </Link>
        </Button>
      </div>

      <section aria-labelledby="templates-heading" className="space-y-3">
        <h2 id="templates-heading" className="text-base font-semibold text-foreground">
          תבניות
        </h2>
        <article className="card-surface flex flex-wrap items-start gap-4 p-5">
          <span
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600"
          >
            <FileCheck2 size={22} />
          </span>
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-foreground">{REPRESENTATION_PROTOCOL.title}</h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700">
                <Lock size={12} aria-hidden="true" />
                נוסח נעול לעריכה
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              הנוסח מהמסמך שלכם, מילה במילה · {PROTOCOL_CLAUSE_COUNT} סעיפים · כל בעל דירה חותם בנפרד, והחתימות
              מתאחדות לטבלה אחת
            </p>
            <p className="text-sm text-foreground">ממלאים: שם המתחם, כתובת, תאריך, מקום הישיבה, חברי הנציגות</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/${locale}/forms/template`}>צפייה בנוסח</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href={`/${locale}/forms/new`}>יצירה לפרויקט</Link>
            </Button>
          </div>
        </article>
      </section>

      <section aria-labelledby="forms-heading" className="space-y-3">
        <h2 id="forms-heading" className="text-base font-semibold text-foreground">
          טפסים לפי מתחם
        </h2>
        <div className="card-surface overflow-x-auto">
          {isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">טוען…</p>
          ) : error ? (
            <p role="alert" className="p-6 text-sm text-red-700">
              {error instanceof Error ? error.message : 'הטפסים לא נטענו'}
            </p>
          ) : !forms?.length ? (
            <div className="p-8 text-center">
              <p className="text-sm font-medium text-foreground">עוד לא נוצר טופס.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                יוצרים טופס למתחם, ממלאים את פרטי האסיפה ושולחים לבעלי הדירות.
              </p>
            </div>
          ) : (
            <table className="w-full min-w-[46rem] text-sm">
              <thead className="border-b border-border bg-gray-50 text-start text-xs text-gray-600">
                <tr>
                  <th scope="col" className="px-4 py-3 text-start font-semibold">מתחם</th>
                  <th scope="col" className="px-4 py-3 text-start font-semibold">טופס</th>
                  <th scope="col" className="px-4 py-3 text-start font-semibold">חתמו</th>
                  <th scope="col" className="px-4 py-3 text-start font-semibold">סטטוס</th>
                  <th scope="col" className="px-4 py-3 text-start font-semibold">עדכון אחרון</th>
                  <th scope="col" className="px-4 py-3 text-start font-semibold">
                    <span className="sr-only">פעולות</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {forms.map((form) => (
                  <FormRow key={form.id} form={form} locale={locale} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <WebsiteFormsSection locale={locale} />
    </div>
  )
}

function FormRow({ form, locale }: { form: FormListItem; locale: string }) {
  const { apartments, apartmentsSigned } = form.progress
  const percent = apartments ? Math.round((apartmentsSigned / apartments) * 100) : 0
  return (
    <tr className="align-middle">
      <td className="px-4 py-3">
        <p className="font-semibold text-foreground">{form.compoundName || form.title}</p>
        <p className="text-xs text-muted-foreground">{form.address || form.project?.name}</p>
      </td>
      <td className="px-4 py-3 text-foreground">פרוטוקול מינוי נציגות</td>
      <td className="px-4 py-3">
        {form.status === 'DRAFT' ? (
          <span className="text-muted-foreground">טרם נשלח</span>
        ) : (
          <div className="w-40 space-y-1">
            <p className="text-xs text-foreground">
              {apartmentsSigned} מתוך {apartments} דירות
            </p>
            <Progress value={percent} aria-label={`${apartmentsSigned} מתוך ${apartments} דירות חתמו`} />
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        <FormStatusBadge status={form.status} />
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {new Date(form.updatedAt).toLocaleDateString('he-IL')}
      </td>
      <td className="px-4 py-3 text-end">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/${locale}/forms/${form.id}`}>{form.status === 'DRAFT' ? 'המשך מילוי' : 'מעקב'}</Link>
        </Button>
      </td>
    </tr>
  )
}
