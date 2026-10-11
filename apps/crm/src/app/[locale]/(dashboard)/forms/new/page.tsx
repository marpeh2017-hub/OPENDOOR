'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ASSEMBLY_NOTICE, ORGANIZING_AGREEMENT, REPRESENTATION_PROTOCOL } from '@urban-renewal/api-contracts'
import { Button } from '@/components/ui/button'
import { FORM_NAMES, formTypeOf, useCreateForm, useFormScopes, type FormText, type FormType } from '@/hooks/use-forms'

/** Each template's wording, as the gateway stores it, and what the screen says about who takes part. */
const TEMPLATES: Record<FormType, { text: FormText; who: string }> = {
  ASSEMBLY_NOTICE: {
    text: ASSEMBLY_NOTICE,
    who: 'בוחרים את המתחם. ההודעה תישלח לכל בעלי הדירות הרשומים בו, כל אחד בקישור משלו.',
  },
  REPRESENTATION_PROTOCOL: {
    text: REPRESENTATION_PROTOCOL,
    who: 'בוחרים את המתחם. כל בעלי הדירות הרשומים בו יחתמו, כל אחד בשורה משלו.',
  },
  ORGANIZING_AGREEMENT: {
    text: ORGANIZING_AGREEMENT,
    who: 'בוחרים את המתחם. כל בעלי הדירות הרשומים בו יחתמו, כל אחד בשורה משלו, והחברה תחתום כמארגנת.',
  },
}

/**
 * A new form: which template and which complex it is for. The draft is
 * created at once, with a row for every owner in the complex, and what the
 * form leaves open is filled in on the form's own page.
 */
export default function NewFormPage() {
  // useSearchParams needs a boundary in the build; the form renders as soon as the address is read.
  return (
    <Suspense fallback={null}>
      <NewForm />
    </Suspense>
  )
}

function NewForm() {
  const { locale } = useParams<{ locale: string }>()
  const router = useRouter()
  const search = useSearchParams()
  const { data: scopes, isLoading } = useFormScopes()
  const create = useCreateForm()
  const [type, setType] = useState<FormType>(formTypeOf(search.get('type') ?? undefined))
  const [projectId, setProjectId] = useState('')
  const [complexId, setComplexId] = useState('')

  const project = scopes?.find((p) => p.id === projectId)
  const complexes = project?.complexes ?? []
  const complex = complexes.find((c) => c.id === complexId)

  const chooseProject = (id: string) => {
    setProjectId(id)
    const only = scopes?.find((p) => p.id === id)?.complexes
    setComplexId(only?.length === 1 ? only[0].id : '')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!projectId || !complexId) return
    const { text } = TEMPLATES[type]
    const form = await create.mutateAsync({ templateId: text.id, projectId, complexId, text })
    router.push(`/${locale}/forms/${form.id}`)
  }

  const selectClass =
    'w-full min-h-11 rounded-md border border-input bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <nav aria-label="מסלול ניווט" className="text-sm text-muted-foreground">
        <Link href={`/${locale}/forms`} className="font-medium text-teal-700 hover:underline">
          טפסים
        </Link>
        <span aria-hidden="true"> › </span>
        <span>טופס חדש</span>
      </nav>

      <div>
        <h1 className="text-2xl font-bold text-foreground">טופס חדש · {FORM_NAMES[type]}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{TEMPLATES[type].who}</p>
      </div>

      <form onSubmit={submit} className="card-surface space-y-5 p-6">
        <fieldset className="space-y-1.5">
          <legend className="text-sm font-semibold text-foreground">הטופס</legend>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(TEMPLATES) as FormType[]).map((option) => (
              <label
                key={option}
                className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm ${
                  type === option ? 'border-teal-600 bg-teal-50 text-teal-900' : 'border-input bg-white text-foreground'
                }`}
              >
                <input
                  type="radio"
                  name="template"
                  value={option}
                  checked={type === option}
                  onChange={() => setType(option)}
                  className="h-4 w-4 accent-teal-600"
                />
                {FORM_NAMES[option]}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="space-y-1.5">
          <label htmlFor="form-project" className="text-sm font-semibold text-foreground">
            פרויקט
          </label>
          <select
            id="form-project"
            value={projectId}
            onChange={(e) => chooseProject(e.target.value)}
            disabled={isLoading}
            className={selectClass}
            required
          >
            <option value="">{isLoading ? 'טוען…' : 'בחירת פרויקט'}</option>
            {scopes?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="form-complex" className="text-sm font-semibold text-foreground">
            מתחם
          </label>
          <select
            id="form-complex"
            value={complexId}
            onChange={(e) => setComplexId(e.target.value)}
            disabled={!project}
            className={selectClass}
            required
          >
            <option value="">{project && complexes.length === 0 ? 'אין מתחמים בפרויקט' : 'בחירת מתחם'}</option>
            {complexes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.address ? ` · ${c.address}` : ''}
              </option>
            ))}
          </select>
          {complex && (
            <p className={`text-sm ${complex.owners ? 'text-muted-foreground' : 'text-red-700'}`}>
              {complex.owners
                ? `${complex.owners} בעלי דירות רשומים ב-${complex.buildings} ${complex.buildings === 1 ? 'בניין' : 'בניינים'}.`
                : 'אין בעלי דירות רשומים במתחם. יש להוסיף בעלים לדירות לפני יצירת טופס.'}
            </p>
          )}
        </div>

        {create.error && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {create.error instanceof Error ? create.error.message : 'הטופס לא נוצר'}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={!complex?.owners || create.isPending}>
            {create.isPending ? 'יוצר…' : 'יצירת טיוטה'}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href={`/${locale}/forms`}>ביטול</Link>
          </Button>
        </div>
      </form>
    </div>
  )
}
