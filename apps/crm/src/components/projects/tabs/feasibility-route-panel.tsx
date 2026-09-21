'use client'

import { useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronLeft, Compass, EyeOff, HelpCircle, History, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  useDecideFeasibilityRoute, useFeasibilityInputRequirements, useFeasibilityRouteHistory, useUpdateFeasibility,
  type RouteAnswers, type RouteOutcome,
} from '@/hooks/use-feasibility'

/*
 * בורר המסלול, האשף, ומה שכל מסלול שואל — בלוח אחד.
 *
 * הלוח הזה הוא המקום שבו ההבטחות של המנוע מתקיימות או נשברות. המנוע אינו
 * מוחק שדה כששינו מסלול; אם הטופס פשוט מעלים אותו, המשתמש יאמין שהנתונים
 * אבדו וינהג בהתאם. המנוע יודע שאחוז הקומבינציה עדיין אינו מזין חישוב; אם
 * הטופס מציג אותו כמו כל שדה אחר, מי שמילא אותו יניח שהוא נספר. לכן כל אחד
 * משלושת המצבים — מוסתר, נשמר-ולא-מחושב, לא-מוכרע — נראה בעין ולא רק קיים.
 */
const ROUTES: [string, string][] = [
  ['PINUY_BINUY', 'פינוי־בינוי'],
  ['TAMA_38_1', 'תמ״א 38/1 — חיזוק'],
  ['TAMA_38_2', 'תמ״א 38/2 — הריסה ובנייה'],
  ['COMBINATION', 'עסקת קומבינציה'],
  ['NEW_CONSTRUCTION', 'רכישת קרקע ובנייה'],
  ['LAND', 'קרקע — רכישה ומכירה ללא בנייה'],
]

const QUESTION_KEYS: Record<string, keyof RouteAnswers> = {
  'מי מחזיק בקרקע היום?': 'landHolder',
  'אתה מתכוון לבנות בעצמך, או למכור את הקרקע והזכויות הלאה?': 'buildIntent',
  'המבנה הקיים ייהרס?': 'demolition',
  'כמה בניינים במתחם?': 'buildingCount',
  'יש הכרזה על מתחם פינוי-בינוי?': 'declaration',
}

export function FeasibilityRoutePanel({ projectId, projectType, canEdit }: { projectId: string; projectType: string; canEdit: boolean }) {
  const requirements = useFeasibilityInputRequirements(projectId)
  const history = useFeasibilityRouteHistory(projectId)
  const decide = useDecideFeasibilityRoute(projectId)
  // בחירה ישירה עוברת בנתיב העריכה הרגיל, ולכן היא מתועדת כמו כל שינוי פרופיל.
  // היא אינה יוצרת החלטת אשף, וזה נכון: לא נענתה שום שאלה.
  const setRoute = useUpdateFeasibility(projectId)

  const [mode, setMode] = useState<'closed' | 'picker' | 'wizard'>('closed')
  const [answers, setAnswers] = useState<RouteAnswers>({})
  const [outcome, setOutcome] = useState<RouteOutcome | null>(null)
  const [showHidden, setShowHidden] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const ask = (next: RouteAnswers) => {
    setAnswers(next)
    decide.mutate(next, { onSuccess: setOutcome })
  }
  const restart = () => { setAnswers({}); setOutcome(null); decide.mutate({}, { onSuccess: setOutcome }) }

  const data = requirements.data
  const notEnforced = (data?.inputs ?? []).filter(input => input.status === 'NOT_ENFORCED')
  const missing = (data?.inputs ?? []).filter(input => input.requirement === 'REQUIRED' && input.status === 'MISSING')
  const latest = history.data?.decisions[0]
  /*
   * דרישה 3: תיק שנשאר לא-מוכרע ונסגר החלון הוא בדיוק המקרה שבו מישהו
   * ימשיך לעבוד בהנחה שהמסלול ידוע. לכן המצב הזה נמצא על הכרטיס, לא בתוך
   * האשף — הוא צריך להיראות גם למי שלא פתח אותו.
   */
  const undecided = latest?.status === 'UNDECIDED' && !history.data?.appliedDecision

  return <section className="card-surface p-5 space-y-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h3 className="text-sm font-semibold flex items-center gap-2"><Compass size={16} />מסלול הפרויקט</h3>
        <p className="mt-1 text-sm">{data?.projectTypeLabel ?? projectType}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {history.data?.appliedDecision
            ? `נקבע באשף · ${new Date(history.data.appliedDecision.createdAt).toLocaleDateString('he-IL')}`
            : 'נקבע ידנית — לא נרשמו התשובות שהובילו לכאן'}
        </p>
      </div>
      {canEdit && <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={mode === 'picker' ? 'default' : 'outline'} onClick={() => setMode(mode === 'picker' ? 'closed' : 'picker')}>בחירה ישירה</Button>
        {/* דרישה 4: מי שבחר וגילה שטעה חוזר לאשף בלי להתחיל מחדש. */}
        <Button size="sm" variant={mode === 'wizard' ? 'default' : 'outline'} onClick={() => { setMode(mode === 'wizard' ? 'closed' : 'wizard'); if (!outcome) restart() }}>
          <HelpCircle className="ml-1 h-3.5 w-3.5" />לא בטוח — שאל אותי
        </Button>
      </div>}
    </div>

    {undecided && <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      <AlertTriangle size={15} className="mt-0.5 shrink-0" />
      <span>המסלול לא הוכרע באשף. המסלול המוצג הוא מה שנקבע ידנית, והשאלה שחסמה את ההכרעה עדיין פתוחה — כדאי להשלים אותה לפני שמסתמכים על הקלטים.</span>
    </div>}

    {mode === 'picker' && <div className="grid gap-2 sm:grid-cols-2">
      {ROUTES.map(([value, label]) => <button
        key={value} type="button" disabled={setRoute.isPending}
        onClick={() => { setRoute.mutate({ projectType: value }); setMode('closed') }}
        className={`rounded-md border px-3 py-2 text-right text-sm ${value === projectType ? 'border-primary bg-primary/5 font-semibold' : 'border-input hover:bg-muted'}`}
      >{label}{value === projectType && ' · נוכחי'}</button>)}
      <p className="sm:col-span-2 text-xs text-muted-foreground">בחירה ישירה משנה את המסלול בלבד. שום נתון שהוזן אינו נמחק.</p>
    </div>}

    {mode === 'wizard' && <div className="space-y-3 rounded-md border border-input p-4">
      {outcome?.reasoning.map((line, index) => <p key={index} className="text-xs text-muted-foreground">✓ {line}</p>)}

      {outcome?.blockedBy && <div className="space-y-3">
        <p className="text-sm font-semibold">{outcome.blockedBy.question}</p>
        {/* דרישה 2 מהסבב הקודם, שהטופס חייב להציג: ההבדל המעשי, לא רק השמות. */}
        <p className="rounded-md bg-muted px-3 py-2 text-xs leading-relaxed">{outcome.blockedBy.difference}</p>
        <div className="grid gap-2">
          {outcome.blockedBy.options.map(option => <button
            key={option.value} type="button" disabled={decide.isPending}
            onClick={() => ask({ ...answers, [QUESTION_KEYS[outcome.blockedBy!.question]!]: option.value } as RouteAnswers)}
            className="flex items-center justify-between rounded-md border border-input px-3 py-2 text-right text-sm hover:bg-muted"
          ><span>{option.label}</span><span className="text-xs text-muted-foreground">{option.leadsTo}</span></button>)}
          <button
            type="button" disabled={decide.isPending}
            onClick={() => ask({ ...answers, [QUESTION_KEYS[outcome.blockedBy!.question]!]: 'UNKNOWN' } as RouteAnswers)}
            className="rounded-md border border-dashed border-input px-3 py-2 text-right text-sm text-muted-foreground hover:bg-muted"
          >איני יודע — נשאיר לא מוכרע ונמשיך</button>
        </div>
      </div>}

      {outcome?.status === 'RESOLVED' && <div className="space-y-3">
        <p className="text-sm">המסלול שעולה מהתשובות: <b>{outcome.projectTypeLabel}</b></p>
        {outcome.warnings.map((warning, index) => <p key={index} className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"><AlertTriangle size={14} className="mt-0.5 shrink-0" />{warning}</p>)}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={decide.isPending || outcome.projectType === projectType}
            onClick={() => decide.mutate({ ...answers, apply: true }, { onSuccess: result => { setOutcome(result); setMode('closed') } })}>
            {decide.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
            {outcome.projectType === projectType ? 'זה כבר המסלול הנוכחי' : 'קבע מסלול זה'}
          </Button>
          <Button size="sm" variant="ghost" onClick={restart}>מהתחלה</Button>
        </div>
      </div>}

      {outcome?.status === 'UNDECIDED' && !outcome.blockedBy && <p className="text-xs text-muted-foreground">אין די תשובות להכרעה. המסלול נשאר כפי שהוא.</p>}
    </div>}

    {/* דרישה 2: שדה שנשמר ואינו מזין חישוב — ולא טופס שנראה מרוצה. */}
    {notEnforced.length > 0 && <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
      <p className="font-semibold">נשמר, ועדיין אינו מזין חישוב:</p>
      <ul className="mt-1 space-y-0.5">{notEnforced.map(input => <li key={input.key}>· {input.label} — {input.intent}</li>)}</ul>
    </div>}

    {missing.length > 0 && <p className="text-xs text-muted-foreground">חסרים {missing.length} קלטי חובה למסלול זה: {missing.map(input => input.label).join(' · ')}</p>}

    {/* דרישה 1: מוסתר, ונראה כמוסתר. ההבטחה שהנתונים לא נמחקו צריכה להיראות. */}
    {(data?.notApplicable.length ?? 0) > 0 && <div className="border-t pt-3">
      <button type="button" onClick={() => setShowHidden(!showHidden)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        {showHidden ? <ChevronDown size={14} /> : <ChevronLeft size={14} />}
        <EyeOff size={14} />
        לא רלוונטי למסלול הנוכחי ({data!.notApplicable.length}) — הנתונים נשמרים
      </button>
      {showHidden && <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
        {data!.notApplicable.map(input => <li key={input.key}>· <span className="font-medium">{input.label}</span> — {input.intent}</li>)}
        <li className="pt-1 italic">שדות אלה אינם נמחקים. מעבר למסלול שמבקש אותם יחזיר אותם עם הערכים שהוזנו.</li>
      </ul>}
    </div>}

    {(history.data?.decisions.length ?? 0) > 0 && <div className="border-t pt-3">
      <button type="button" onClick={() => setShowHistory(!showHistory)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        {showHistory ? <ChevronDown size={14} /> : <ChevronLeft size={14} />}
        <History size={14} />
        איך נקבע המסלול ({history.data!.decisions.length})
      </button>
      {showHistory && <ol className="mt-2 space-y-2 text-xs">
        {history.data!.decisions.map(decision => <li key={decision.id} className="rounded-md border border-input px-3 py-2">
          <p className="font-medium">
            {decision.status === 'RESOLVED' ? (decision.resolvedProjectType ?? '—') : 'לא הוכרע'}
            {decision.appliedToProfile ? ' · נקבע' : ' · נבדק בלבד'}
            <span className="font-normal text-muted-foreground"> · {new Date(decision.createdAt).toLocaleString('he-IL')}</span>
          </p>
          {decision.reasoning.map((line, index) => <p key={index} className="text-muted-foreground">· {line}</p>)}
          {decision.warnings.map((warning, index) => <p key={index} className="text-amber-800">⚠ {warning}</p>)}
        </li>)}
      </ol>}
    </div>}
  </section>
}
