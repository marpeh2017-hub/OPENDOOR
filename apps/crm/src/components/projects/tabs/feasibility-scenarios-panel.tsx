'use client'

import { FormEvent, useState } from 'react'
import { Calculator, Copy, Loader2, Pencil, Plus, TableProperties, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  useAddUnitMixLine,
  useDeleteUnitMixLine,
  useCalculateFeasibility,
  useCreateFeasibilityScenario,
  useDuplicateFeasibilityScenario,
  useUpdateUnitMixLine,
  type FeasibilityCalculation, type FeasibilityScenario, type FeasibilitySensitivity, type FeasibilitySensitivityInput, type FeasibilitySensitivityVariable, type FeasibilitySource, useRunFeasibilitySensitivity,
} from '@/hooks/use-feasibility'
import { FeasibilityAnalysis, FeasibilityScenarioComparison, FeasibilitySensitivityMatrix } from './feasibility-analysis'
import { FeasibilityEconomicsPanel } from './feasibility-economics-panel'

const SCENARIO_KINDS: Array<[FeasibilityScenario['kind'], string]> = [
  ['BASE', 'בסיס'],
  ['CONSERVATIVE', 'שמרני'],
  ['OPTIMISTIC', 'אופטימי'],
  ['CUSTOM', 'מותאם'],
]
const SENSITIVITY_VARIABLES: Array<[FeasibilitySensitivityVariable, string]> = [
  ['SALE_PRICE', 'מחיר מכירה'], ['CONSTRUCTION_COST', 'עלות בנייה'], ['LAND_COST', 'עלות קרקע'], ['INTEREST_RATE', 'ריבית מימון'], ['DISCOUNT_RATE', 'שיעור היוון'],
]
const sensitivityLabel = (value: FeasibilitySensitivityVariable) => SENSITIVITY_VARIABLES.find(([key]) => key === value)?.[1] ?? value

function message(error: unknown) {
  return error instanceof Error ? error.message : 'הפעולה נכשלה. בדקו את הנתונים ונסו שוב.'
}

export function FeasibilityScenariosPanel({ projectId, scenarios, sources, canEdit }: { projectId: string; scenarios: FeasibilityScenario[]; sources: FeasibilitySource[]; canEdit: boolean }) {
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<FeasibilityScenario['kind']>('BASE')
  const create = useCreateFeasibilityScenario(projectId)
  const duplicate = useDuplicateFeasibilityScenario(projectId)
  const calculate = useCalculateFeasibility(projectId)
  const [results, setResults] = useState<Record<string, FeasibilityCalculation>>({})

  const submit = (event: FormEvent) => {
    event.preventDefault()
    create.mutate({ name, kind }, { onSuccess: () => { setName(''); setKind('CUSTOM'); setCreateOpen(false) } })
  }

  return <section className="card-surface p-5">
    <div className="flex items-center justify-between gap-3">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold"><TableProperties size={17} />תרחישי תכנון ותמהיל</h3>
        <p className="mt-1 text-xs text-muted-foreground">כל תרחיש עצמאי. שכפול יוצר עותק חדש ואינו משנה את המקור.</p>
      </div>
      {canEdit && <Button variant="outline" size="sm" onClick={() => setCreateOpen((open) => !open)}><Plus size={14} className="ml-1" />תרחיש חדש</Button>}
    </div>

    {createOpen && <form onSubmit={submit} className="mt-4 grid grid-cols-1 gap-3 border-t pt-4 sm:grid-cols-[1fr_11rem_auto] sm:items-end">
      <label className="grid gap-1.5 text-sm font-medium"><span>שם התרחיש</span><Input required value={name} onChange={(event) => setName(event.target.value)} maxLength={160} /></label>
      <label className="grid gap-1.5 text-sm font-medium"><span>סוג</span><select value={kind} onChange={(event) => setKind(event.target.value as FeasibilityScenario['kind'])} className="h-10 rounded-md border border-input bg-background px-3 text-sm">{SCENARIO_KINDS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <Button disabled={create.isPending}>{create.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}שמירה</Button>
      {create.isError && <p className="text-sm text-destructive sm:col-span-3" role="alert">{message(create.error)}</p>}
    </form>}

    {!scenarios.length && <p className="mt-4 text-sm text-muted-foreground">עדיין לא הוגדר תרחיש. התחילו בתרחיש בסיס לפני הזנת הכנסות ועלויות.</p>}
    {scenarios.length > 0 && <div className="mt-4 grid gap-3 xl:grid-cols-2">
      {scenarios.map((scenario) => <ScenarioCard key={scenario.id} projectId={projectId} scenario={scenario} sources={sources} canEdit={canEdit} onDuplicate={() => duplicate.mutate(scenario.id)} duplicatePending={duplicate.isPending} calculation={results[scenario.id]} calculationPending={calculate.isPending} onCalculate={() => calculate.mutate(scenario.id, { onSuccess: (result) => setResults((current) => ({ ...current, [scenario.id]: result })) })} />)}
    </div>}
    <FeasibilityScenarioComparison scenarios={scenarios.flatMap((scenario) => results[scenario.id] ? [{ name: scenario.name, calculation: results[scenario.id] }] : [])} />
    {duplicate.isError && <p className="mt-3 text-sm text-destructive" role="alert">{message(duplicate.error)}</p>}
  </section>
}

function ScenarioCard({ projectId, scenario, sources, canEdit, onDuplicate, duplicatePending, calculation, calculationPending, onCalculate }: { projectId: string; scenario: FeasibilityScenario; sources: FeasibilitySource[]; canEdit: boolean; onDuplicate: () => void; duplicatePending: boolean; calculation?: FeasibilityCalculation; calculationPending: boolean; onCalculate: () => void }) {
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteLine, setDeleteLine] = useState<{ id: string; label: string } | null>(null)
  const [label, setLabel] = useState('')
  const [unitCount, setUnitCount] = useState('')
  const [saleableAreaSqm, setSaleableAreaSqm] = useState('')
  const [pricePerSqm, setPricePerSqm] = useState('')
  const [sourceId, setSourceId] = useState('')
  const [isVerified, setIsVerified] = useState(false)
  const addLine = useAddUnitMixLine(projectId, scenario.id)
  const updateLine = useUpdateUnitMixLine(projectId, scenario.id)
  const removeLine = useDeleteUnitMixLine(projectId, scenario.id)
  const sensitivity = useRunFeasibilitySensitivity(projectId)
  const [sensitivityResult, setSensitivityResult] = useState<FeasibilitySensitivity | null>(null)
  const [sensitivityOpen, setSensitivityOpen] = useState(false)
  const [primaryVariable, setPrimaryVariable] = useState<FeasibilitySensitivityVariable>('SALE_PRICE')
  const [secondaryVariable, setSecondaryVariable] = useState<'' | FeasibilitySensitivityVariable>('CONSTRUCTION_COST')
  const [primaryChanges, setPrimaryChanges] = useState('-15, -10, -5, 0, 5, 10, 15')
  const [secondaryChanges, setSecondaryChanges] = useState('-10, -5, 0, 5, 10')
  const parseChanges = (value: string) => value.split(',').map((entry) => entry.trim()).filter(Boolean)
  const runSensitivity = () => {
    const dto: FeasibilitySensitivityInput = { primaryVariable, primaryChanges: parseChanges(primaryChanges), ...(secondaryVariable ? { secondaryVariable, secondaryChanges: parseChanges(secondaryChanges) } : {}) }
    sensitivity.mutate({ scenarioId: scenario.id, dto }, { onSuccess: setSensitivityResult })
  }

  const closeUnitMix = () => { setOpen(false); setEditingId(null); setLabel(''); setUnitCount(''); setSaleableAreaSqm(''); setPricePerSqm(''); setSourceId(''); setIsVerified(false) }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const dto = { label, unitCount: Number(unitCount), ...(saleableAreaSqm ? { saleableAreaSqm } : {}), ...(pricePerSqm ? { pricePerSqm } : {}), ...(sourceId ? { sourceId } : {}), isVerified }
    if (editingId) updateLine.mutate({ lineId: editingId, dto }, { onSuccess: closeUnitMix })
    else addLine.mutate(dto, { onSuccess: closeUnitMix })
  }
  const startEditUnitMix = (line: FeasibilityScenario['unitMix'][number]) => { setEditingId(line.id); setLabel(line.label); setUnitCount(String(line.unitCount)); setSaleableAreaSqm(line.saleableAreaSqm ?? ''); setPricePerSqm(line.pricePerSqm ?? ''); setSourceId(line.sourceId ?? ''); setIsVerified(line.isVerified); setOpen(true) }

  return <article className="rounded-lg border border-border bg-background p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><div className="flex items-center gap-2"><h4 className="font-semibold">{scenario.name}</h4>{scenario.isBaseline && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">בסיס</span>}</div><p className="mt-1 text-xs text-muted-foreground">{SCENARIO_KINDS.find(([value]) => value === scenario.kind)?.[1]} · {scenario.unitMix.length} שורות תמהיל</p></div>
      {canEdit && <div className="flex flex-wrap gap-2"><Button variant="ghost" size="sm" onClick={onDuplicate} disabled={duplicatePending}><Copy size={14} className="ml-1" />שכפול</Button><Button variant="outline" size="sm" onClick={() => open ? closeUnitMix() : setOpen(true)}><Plus size={14} className="ml-1" />תמהיל</Button><Button variant="outline" size="sm" onClick={() => setSensitivityOpen((value) => !value)}>רגישות</Button><Button size="sm" onClick={onCalculate} disabled={calculationPending}><Calculator size={14} className="ml-1" />חישוב</Button></div>}
    </div>
    {scenario.unitMix.length > 0 && <ul className="mt-3 divide-y divide-border text-sm">{scenario.unitMix.map((line) => <li className="flex justify-between gap-3 py-2" key={line.id}><span>{line.label} · {line.unitCount} יח״ד</span><span className="flex items-center gap-1 text-muted-foreground">{line.saleableAreaSqm ? `${line.saleableAreaSqm} מ״ר למכירה` : 'שטח חסר'}{line.pricePerSqm ? ` · ₪${line.pricePerSqm}/מ״ר` : ''}{canEdit && <><Button aria-label={`עריכת ${line.label}`} size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEditUnitMix(line)}><Pencil size={14} /></Button><Button aria-label={`מחיקת ${line.label}`} size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteLine({ id: line.id, label: line.label })}><Trash2 size={14} /></Button></>}</span></li>)}</ul>}
    {open && <form onSubmit={submit} className="mt-4 grid grid-cols-1 gap-3 border-t pt-4 sm:grid-cols-2">
      <label className="grid gap-1.5 text-sm font-medium"><span>סוג יחידה</span><Input required value={label} onChange={(event) => setLabel(event.target.value)} maxLength={160} /></label>
      <label className="grid gap-1.5 text-sm font-medium"><span>מספר יח״ד</span><Input required min="1" type="number" value={unitCount} onChange={(event) => setUnitCount(event.target.value)} /></label>
      <label className="grid gap-1.5 text-sm font-medium"><span>שטח למכירה במ״ר</span><Input inputMode="decimal" value={saleableAreaSqm} onChange={(event) => setSaleableAreaSqm(event.target.value)} /></label>
      <label className="grid gap-1.5 text-sm font-medium"><span>מחיר למ״ר לפני מע״מ</span><Input inputMode="decimal" value={pricePerSqm} onChange={(event) => setPricePerSqm(event.target.value)} /></label>
      <label className="grid gap-1.5 text-sm font-medium"><span>מקור</span><select value={sourceId} onChange={(event) => setSourceId(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="">ללא מקור מקושר</option>{sources.map((source) => <option key={source.id} value={source.id}>{source.title}</option>)}</select></label>
      <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium"><input type="checkbox" checked={isVerified} onChange={(event) => setIsVerified(event.target.checked)} />אומת מקצועית</label>
      <div className="flex items-center justify-end gap-3 sm:col-span-2"><Button type="button" variant="ghost" onClick={closeUnitMix}>ביטול</Button><Button disabled={addLine.isPending || updateLine.isPending}>{(addLine.isPending || updateLine.isPending) && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}{editingId ? 'שמירת שינויים' : 'הוספת שורה'}</Button></div>
      {(addLine.isError || updateLine.isError) && <p className="text-sm text-destructive sm:col-span-2" role="alert">{message(addLine.error ?? updateLine.error)}</p>}
    </form>}
    <ConfirmDialog open={Boolean(deleteLine)} onOpenChange={(value) => { if (!value) setDeleteLine(null) }} title="למחוק שורת תמהיל?" description={<>השורה „{deleteLine?.label}” תוסר מהתרחיש. הפעולה מתועדת ולא ניתן לשחזר אותה ללא הזנה מחדש.</>} confirmLabel="מחיקה" destructive pending={removeLine.isPending} error={removeLine.error} onConfirm={() => deleteLine && removeLine.mutate(deleteLine.id, { onSuccess: () => setDeleteLine(null) })} />
    <FeasibilityEconomicsPanel projectId={projectId} scenario={scenario} sources={sources} canEdit={canEdit} />
    {sensitivityOpen && <form onSubmit={(event) => { event.preventDefault(); runSensitivity() }} className="mt-4 grid grid-cols-1 gap-3 border-t pt-4 sm:grid-cols-2">
      <label className="grid gap-1.5 text-sm font-medium"><span>משתנה ראשון</span><select value={primaryVariable} onChange={(event) => { const value = event.target.value as FeasibilitySensitivityVariable; setPrimaryVariable(value); if (secondaryVariable === value) setSecondaryVariable('') }} className="h-10 rounded-md border border-input bg-background px-3 text-sm">{SENSITIVITY_VARIABLES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="grid gap-1.5 text-sm font-medium"><span>משתנה שני (אופציונלי)</span><select value={secondaryVariable} onChange={(event) => setSecondaryVariable(event.target.value as '' | FeasibilitySensitivityVariable)} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="">ללא משתנה שני</option>{SENSITIVITY_VARIABLES.filter(([value]) => value !== primaryVariable).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="grid gap-1.5 text-sm font-medium"><span>שינויי {sensitivityLabel(primaryVariable)} (%)</span><Input required value={primaryChanges} onChange={(event) => setPrimaryChanges(event.target.value)} /></label>
      {secondaryVariable && <label className="grid gap-1.5 text-sm font-medium"><span>שינויי {sensitivityLabel(secondaryVariable)} (%)</span><Input required value={secondaryChanges} onChange={(event) => setSecondaryChanges(event.target.value)} /></label>}
      <div className="flex items-center justify-end gap-3 sm:col-span-2"><Button type="button" variant="ghost" onClick={() => setSensitivityOpen(false)}>ביטול</Button><Button disabled={sensitivity.isPending}>{sensitivity.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}הרצת מטריצה</Button></div>
      {sensitivity.isError && <p className="text-sm text-destructive sm:col-span-2" role="alert">{message(sensitivity.error)}</p>}
    </form>}
    {calculation && <div className="mt-4 space-y-3 border-t pt-4" aria-live="polite">
      <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3"><Kpi label="הכנסות" value={calculation.revenue.total} /><Kpi label="עלויות" value={calculation.costs.total} /><Kpi label="רווח לפני מימון" value={calculation.profitability.profitBeforeFinancing} /></div>
      <FeasibilityAnalysis calculation={calculation} />
    </div>}
    {sensitivityResult && <FeasibilitySensitivityMatrix result={sensitivityResult} />}
  </article>
}

function Kpi({ label, value }: { label: string; value: string }) { return <div className="rounded-md bg-muted/60 px-3 py-2"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold tabular-nums">₪{value}</p></div> }
