'use client'

import { FormEvent, useState } from 'react'
import { BookOpen, Building2, LandPlot, Loader2, Pencil, Plus, Scale, Ruler, ShieldAlert, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState, QueryError, RowsSkeleton } from '@/components/ui/query-states'
import { useCanEditFeasibility, useIsManager } from '@/hooks/use-auth'
import { type DocumentMeta, useDocuments } from '@/hooks/use-documents'
import { useAddFeasibilityItem, useCreateFeasibility, useDeleteFeasibilityItem, useFeasibility, useUpdateFeasibility, useUpdateFeasibilityItem, type ProfileInput } from '@/hooks/use-feasibility'
import { FeasibilityScenariosPanel } from './feasibility-scenarios-panel'
import { FeasibilityComparablesPanel } from './feasibility-comparables-panel'
import { FeasibilityReportVersionsPanel } from './feasibility-report-versions-panel'
import { FeasibilityRulesPanel } from './feasibility-rules-panel'

/*
 * המסלולים שמוצגים לבחירה, בתוויות שהשרת מחזיר. `OTHER` אינו כאן בכוונה:
 * מסלול שלא הוגדר אינו מסלול, והוא נשאר קריא בתצוגה של פרופיל קיים.
 *
 * הרשימה הזו היתה אחת משלוש — CRM, ייצוא PDF וייצוא Excel — וכל תוספת
 * מסלול היתה צריכה לגעת בשלושתן. השניים האחרים קוראים עכשיו מטבלת
 * המסלולים בשרת, וזו כאן היא מה שמוצג לבחירה בלבד.
 */
const PROJECT_TYPES = [
  ['PINUY_BINUY', 'פינוי־בינוי'], ['TAMA_38_1', 'תמ״א 38/1 — חיזוק'], ['TAMA_38_2', 'תמ״א 38/2 — הריסה ובנייה'],
  ['COMBINATION', 'עסקת קומבינציה'], ['NEW_CONSTRUCTION', 'רכישת קרקע ובנייה'], ['LAND', 'קרקע — רכישה ומכירה ללא בנייה'],
]
const PROJECT_TYPE_FALLBACK: Record<string, string> = { OTHER: 'אחר' }
const projectTypeLabel = (value: string) =>
  PROJECT_TYPES.find(entry => entry[0] === value)?.[1] ?? PROJECT_TYPE_FALLBACK[value] ?? value
const AREA_LABELS: Record<string, string> = { REGISTERED: 'רשום', MEASURED: 'מדוד', PLANNING: 'תכנוני', MAIN: 'עיקרי', SERVICE: 'שירות', GROSS: 'ברוטו', SALEABLE: 'למכירה', MARKETING: 'שיווקי', BALCONY: 'מרפסות', GARDEN: 'גינות', ROOF: 'גג', PARKING: 'חניה', STORAGE: 'מחסנים', COMMERCIAL: 'מסחר', COMMON: 'שטחים משותפים' }

function errorText(error: unknown) { return error instanceof Error ? error.message : 'הפעולה נכשלה. בדקו את הנתונים ונסו שוב.' }
function dateValue() { return new Date().toISOString().slice(0, 10) }

export function ProjectFeasibilityTab({ projectId }: { projectId: string }) {
  const { data, isLoading, isError, error, refetch } = useFeasibility(projectId)
  const canEdit = useCanEditFeasibility()
  const canTransition = useIsManager()
  const create = useCreateFeasibility(projectId)
  const updateProfile = useUpdateFeasibility(projectId)
  const documents = useDocuments({ projectId })
  const [form, setForm] = useState<ProfileInput>({ projectType: 'TAMA_38_1', purpose: '', valuationDate: dateValue(), reportDate: dateValue() })
  const [editingProfile, setEditingProfile] = useState(false)

  if (isLoading) return <div className="card-surface"><RowsSkeleton rows={6} /></div>
  if (isError) return <QueryError message="שגיאה בטעינת דוח האפס" error={error} onRetry={() => refetch()} />
  if (!data) {
    if (!canEdit) return <div className="card-surface"><EmptyState message="טרם הוגדר דוח אפס לפרויקט" hint="משתמש בעל הרשאה יכול לפתוח פרופיל היתכנות." /></div>
    return <section className="card-surface p-6 max-w-3xl space-y-5">
      <div><h2 className="text-lg font-bold">פתיחת פרופיל דוח אפס</h2><p className="text-sm text-muted-foreground mt-1">נתוני המקור נשמרים בנפרד מהנחות ומתוצאות חישוב.</p></div>
      <form className="grid grid-cols-1 sm:grid-cols-2 gap-4" onSubmit={(e) => { e.preventDefault(); create.mutate(form) }}>
        <Field label="סוג פרויקט"><select value={form.projectType} onChange={e => setForm({ ...form, projectType: e.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{PROJECT_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
        <Field label="מטרת הבדיקה"><Input required value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })} /></Field>
        <Field label="תאריך קובע"><Input required type="date" value={form.valuationDate} onChange={e => setForm({ ...form, valuationDate: e.target.value })} /></Field>
        <Field label="תאריך דוח"><Input required type="date" value={form.reportDate} onChange={e => setForm({ ...form, reportDate: e.target.value })} /></Field>
        <Field label="לקוח"><Input value={form.clientName ?? ''} onChange={e => setForm({ ...form, clientName: e.target.value })} /></Field>
        <Field label="יזם"><Input value={form.developerName ?? ''} onChange={e => setForm({ ...form, developerName: e.target.value })} /></Field>
        <div className="sm:col-span-2 flex items-center justify-between gap-3 border-t pt-4"><p className="text-xs text-muted-foreground">כל הסכומים בדוח האפס ינוהלו לפני מע״מ כברירת מחדל.</p><Button disabled={create.isPending}>{create.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}פתיחת פרופיל</Button></div>
        {create.isError && <p className="sm:col-span-2 text-sm text-destructive" role="alert">{errorText(create.error)}</p>}
      </form>
    </section>
  }

  return <div className="space-y-5">
    <div className="card-surface p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div><h2 className="text-lg font-bold">דוח אפס · {projectTypeLabel(data.projectType)}</h2><p className="text-sm text-muted-foreground">תאריך קובע: {new Date(data.valuationDate).toLocaleDateString('he-IL')} · מצב: {data.status === 'LOCKED' ? 'נעול' : 'טיוטה'}</p></div>
      <div className="flex flex-wrap items-center gap-2"><div className="inline-flex items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2"><ShieldAlert size={15} />נתוני המקור טרם חושבו לרווחיות</div>{canEdit && <Button size="sm" variant="outline" onClick={() => { setForm({ projectType: data.projectType, reportType: data.reportType, purpose: data.purpose, valuationDate: data.valuationDate.slice(0, 10), reportDate: data.reportDate.slice(0, 10), clientName: data.clientName ?? '', developerName: data.developerName ?? '', appraiserName: data.appraiserName ?? '', neighborhood: data.neighborhood ?? '' }); setEditingProfile(true) }}><Pencil className="ml-1 h-3.5 w-3.5" />עריכת פרטי דוח</Button>}</div>
    </div>
    {editingProfile && <section className="card-surface p-5"><div><h3 className="text-sm font-semibold">פרטי דוח אפס</h3><p className="mt-1 text-xs text-muted-foreground">העדכון מתועד ומשפיע רק על צילומי חישוב חדשים; גרסאות קפואות אינן משתנות.</p></div><form className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); updateProfile.mutate(form, { onSuccess: () => setEditingProfile(false) }) }}><Field label="סוג פרויקט"><select value={form.projectType} onChange={event => setForm({ ...form, projectType: event.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{PROJECT_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="מטרת הבדיקה"><Input required value={form.purpose} onChange={event => setForm({ ...form, purpose: event.target.value })} /></Field><Field label="תאריך קובע"><Input required type="date" value={form.valuationDate} onChange={event => setForm({ ...form, valuationDate: event.target.value })} /></Field><Field label="תאריך דוח"><Input required type="date" value={form.reportDate} onChange={event => setForm({ ...form, reportDate: event.target.value })} /></Field><Field label="לקוח"><Input value={form.clientName ?? ''} onChange={event => setForm({ ...form, clientName: event.target.value })} /></Field><Field label="יזם"><Input value={form.developerName ?? ''} onChange={event => setForm({ ...form, developerName: event.target.value })} /></Field><Field label="שמאי"><Input value={form.appraiserName ?? ''} onChange={event => setForm({ ...form, appraiserName: event.target.value })} /></Field><Field label="שכונה"><Input value={form.neighborhood ?? ''} onChange={event => setForm({ ...form, neighborhood: event.target.value })} /></Field><div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="ghost" onClick={() => setEditingProfile(false)}>ביטול</Button><Button disabled={updateProfile.isPending}>{updateProfile.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}שמירה</Button></div>{updateProfile.isError && <p className="text-sm text-destructive sm:col-span-2" role="alert">{errorText(updateProfile.error)}</p>}</form></section>}
    <FoundationSection title="גוש וחלקה" icon={<LandPlot size={17} />} count={data.parcels.length} canEdit={canEdit} path="parcels" projectId={projectId} sources={data.sources} fields={[['gush','גוש',true],['chelka','חלקה',true],['subChelka','תת־חלקה'],['landAreaSqm','שטח חלקה במ״ר'],['address','כתובת']]}> 
      {data.parcels.map(x => <EditableFoundationRow key={x.id} projectId={projectId} path="parcels" canEdit={canEdit} item={x} fields={[['gush','גוש',true],['chelka','חלקה',true],['subChelka','תת־חלקה'],['landAreaSqm','שטח חלקה במ״ר'],['address','כתובת']]} primary={`גוש ${x.gush} · חלקה ${x.chelka}${x.subChelka ? ` · תת־חלקה ${x.subChelka}` : ''}`} detail={[x.landAreaSqm ? `${x.landAreaSqm} מ״ר` : null, x.address].filter(Boolean).join(' · ')} />)}
    </FoundationSection>
    <FoundationSection title="מקורות" icon={<BookOpen size={17} />} count={data.sources.length} canEdit={canEdit} path="sources" projectId={projectId} documents={documents.data ?? []} fields={[['type','סוג מקור',true,'PLANNING'],['title','כותרת',true],['issuer','מנפיק'],['sourceDate','תאריך',false,'date'],['documentId','מסמך בספרייה'],['sourceUrl','כתובת מקור'],['pageReference','עמוד/סעיף']]}> 
      {data.sources.map(x => <EditableFoundationRow key={x.id} projectId={projectId} path="sources" canEdit={canEdit} documents={documents.data ?? []} item={x} fields={[['type','סוג מקור',true,'PLANNING'],['title','כותרת',true],['issuer','מנפיק'],['sourceDate','תאריך',false,'date'],['documentId','מסמך בספרייה'],['sourceUrl','כתובת מקור'],['pageReference','עמוד/סעיף']]} primary={x.title} detail={[x.type, x.issuer, x.documentId ? 'מסמך מקושר' : null, x.sourceDate ? new Date(x.sourceDate).toLocaleDateString('he-IL') : null].filter(Boolean).join(' · ')} />)}
    </FoundationSection>
    <FoundationSection title="הנחות" icon={<Scale size={17} />} count={data.assumptions.length} canEdit={canEdit} path="assumptions" projectId={projectId} sources={data.sources} fields={[['key','מפתח',true],['label','שם ההנחה',true],['value','ערך'],['unit','יחידה'],['impact','השפעה']]}> 
      {data.assumptions.map(x => <EditableFoundationRow key={x.id} projectId={projectId} path="assumptions" canEdit={canEdit} item={x} fields={[['key','מפתח',true],['label','שם ההנחה',true],['value','ערך'],['unit','יחידה'],['impact','השפעה']]} primary={x.label} detail={[x.value, x.unit, x.impact].filter(Boolean).join(' · ')} />)}
    </FoundationSection>
    <FoundationSection title="טבלת שטחים" icon={<Ruler size={17} />} count={data.areas.length} canEdit={canEdit} path="areas" projectId={projectId} sources={data.sources} fields={[['areaType','סוג שטח',true,'GROSS'],['valueSqm','מ״ר',true],['label','הערה']]}> 
      {data.areas.map(x => <EditableFoundationRow key={x.id} projectId={projectId} path="areas" canEdit={canEdit} item={x} fields={[['areaType','סוג שטח',true],['valueSqm','מ״ר',true],['label','הערה']]} primary={AREA_LABELS[x.areaType] ?? x.areaType} detail={`${x.valueSqm} מ״ר${x.label ? ` · ${x.label}` : ''}`} />)}
    </FoundationSection>
    <FoundationSection title="זכויות תכנון" icon={<Building2 size={17} />} count={data.planningRights.length} canEdit={canEdit} path="planning-rights" projectId={projectId} sources={data.sources} fields={[['category','קטגוריה',true],['status','סטטוס',true,'APPROVED'],['areaSqm','שטח במ״ר'],['unitCount','יח״ד'],['planNumber','מספר תכנית']]}> 
      {data.planningRights.map(x => <EditableFoundationRow key={x.id} projectId={projectId} path="planning-rights" canEdit={canEdit} item={x} fields={[['category','קטגוריה',true],['status','סטטוס',true],['areaSqm','שטח במ״ר'],['unitCount','יח״ד'],['planNumber','מספר תכנית']]} primary={x.category} detail={[x.status, x.areaSqm ? `${x.areaSqm} מ״ר` : null, x.unitCount ? `${x.unitCount} יח״ד` : null, x.planNumber].filter(Boolean).join(' · ')} />)}
    </FoundationSection>
    <FeasibilityRulesPanel profileId={data.id} />
    <FeasibilityComparablesPanel projectId={projectId} comparables={data.comparableTransactions} sources={data.sources} canEdit={canEdit} />
    <FeasibilityScenariosPanel projectId={projectId} scenarios={data.scenarios} sources={data.sources} canEdit={canEdit} />
    <FeasibilityReportVersionsPanel projectId={projectId} scenarios={data.scenarios} canEdit={canEdit} canTransition={canTransition} />
  </div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-1.5 text-sm font-medium"><span>{label}</span>{children}</label> }
function Row({ primary, detail }: { primary: string; detail: string }) { return <li className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:items-center sm:justify-between"><span className="text-sm font-medium">{primary}</span><span className="text-xs text-muted-foreground">{detail || 'ללא פירוט'}</span></li> }
type ItemPath = 'parcels' | 'sources' | 'assumptions' | 'areas' | 'planning-rights'
type SimpleField = [string, string, boolean?, string?]
type EditableItem = { id: string; [key: string]: unknown }
function DocumentPicker({ value, documents, onChange }: { value: string; documents: DocumentMeta[]; onChange: (value: string) => void }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="">ללא מסמך מקושר</option>{documents.map((document) => <option key={document.id} value={document.id}>{document.title} · גרסה {document.version}</option>)}</select>
}
function EditableFoundationRow({ projectId, path, canEdit, item, fields, primary, detail, documents = [] }: { projectId: string; path: ItemPath; canEdit: boolean; item: EditableItem; fields: SimpleField[]; primary: string; detail: string; documents?: DocumentMeta[] }) {
  const [editing, setEditing] = useState(false); const [removing, setRemoving] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})
  const update = useUpdateFeasibilityItem(projectId, path, item.id); const remove = useDeleteFeasibilityItem(projectId, path)
  const openEdit = () => { setValues(Object.fromEntries(fields.map(([key]) => [key, item[key] == null ? '' : key === 'sourceDate' ? new Date(String(item[key])).toISOString().slice(0, 10) : String(item[key])]))); setEditing(true) }
  const submit = (event: FormEvent) => { event.preventDefault(); const dto = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== '')); update.mutate(dto, { onSuccess: () => setEditing(false) }) }
  return <li className="py-2.5"><div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><span className="text-sm font-medium">{primary}</span><span className="flex items-center gap-1 text-xs text-muted-foreground">{detail || 'ללא פירוט'}{canEdit && <><Button aria-label={`עריכת ${primary}`} size="icon" variant="ghost" className="h-7 w-7" onClick={openEdit}><Pencil size={14} /></Button><Button aria-label={`מחיקת ${primary}`} size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setRemoving(true)}><Trash2 size={14} /></Button></>}</span></div>{editing && <form onSubmit={submit} className="mt-3 grid gap-3 border-t pt-3 sm:grid-cols-2">{fields.map(([key, label, required, kind]) => <Field key={key} label={label}>{key === 'type' ? <select required={required} value={values[key] ?? ''} onChange={(e) => setValues({ ...values, [key]: e.target.value })} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="PLANNING">תכנון</option><option value="APPRAISAL">שמאות</option><option value="GOVERNMENT">ממשלתי</option><option value="USER">הזנה ידנית</option><option value="OTHER">אחר</option></select> : key === 'documentId' ? <DocumentPicker value={values[key] ?? ''} documents={documents} onChange={(value) => setValues({ ...values, [key]: value })} /> : <Input required={required} type={kind === 'date' ? 'date' : 'text'} value={values[key] ?? ''} onChange={(e) => setValues({ ...values, [key]: e.target.value })} />}</Field>)}<div className="flex items-center justify-end gap-2 sm:col-span-2"><Button type="button" variant="ghost" onClick={() => setEditing(false)}>ביטול</Button><Button disabled={update.isPending}>{update.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}שמירה</Button></div>{update.isError && <p className="text-sm text-destructive sm:col-span-2" role="alert">{errorText(update.error)}</p>}</form>}<ConfirmDialog open={removing} onOpenChange={setRemoving} title="למחוק נתון מקור?" description="המחיקה מתועדת. מקור שמקושר לנתוני מודל לא יימחק עד לניתוק הקישורים שלו." confirmLabel="מחיקה" destructive pending={remove.isPending} error={remove.error} onConfirm={() => remove.mutate(item.id, { onSuccess: () => setRemoving(false) })} /></li>
}
function FoundationSection({ title, icon, count, canEdit, projectId, path, fields, sources = [], documents = [], children }: { title: string; icon: React.ReactNode; count: number; canEdit: boolean; projectId: string; path: ItemPath; fields: SimpleField[]; sources?: Array<{ id: string; title: string }>; documents?: DocumentMeta[]; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({ classification: 'SOURCE_DATA', confidence: 'MEDIUM' })
  const mutation = useAddFeasibilityItem(projectId, path)
  const set = (key: string, value: string) => setValues((current) => ({ ...current, [key]: value }))
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const payload = { ...values }
    // The API's global implicit conversion must never receive the string
    // "false" for a boolean: some transformers treat any non-empty string as
    // truthy. An unchecked box is simply omitted, which preserves the server
    // default of false.
    if (payload.isVerified !== 'true') delete payload.isVerified
    mutation.mutate(payload, { onSuccess: () => { setValues({ classification: 'SOURCE_DATA', confidence: 'MEDIUM' }); setOpen(false) } })
  }
  return <section className="card-surface p-5">
    <div className="flex items-center justify-between gap-3"><h3 className="flex items-center gap-2 text-sm font-semibold">{icon}{title}<span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{count}</span></h3>{canEdit && <Button variant="outline" size="sm" onClick={() => setOpen(!open)}><Plus size={14} className="ml-1" />הוספה</Button>}</div>
    {count ? <ul className="mt-3 divide-y divide-border">{children}</ul> : <p className="mt-3 text-sm text-muted-foreground">עדיין לא הוזנו נתונים.</p>}
    {open && <form id={`feasibility-${path}`} onSubmit={submit} className="mt-4 grid grid-cols-1 gap-3 border-t pt-4 sm:grid-cols-2">
      {fields.map(([key, label, required, kind]) => <Field key={key} label={label}>
        {key === 'type' ? <select required={required} value={values[key] ?? kind ?? ''} onChange={e => set(key, e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="PLANNING">תכנון</option><option value="APPRAISAL">שמאות</option><option value="GOVERNMENT">ממשלתי</option><option value="USER">הזנה ידנית</option><option value="OTHER">אחר</option></select> : key === 'documentId' ? <DocumentPicker value={values[key] ?? ''} documents={documents} onChange={(value) => set(key, value)} /> : <Input required={required} type={kind === 'date' ? 'date' : 'text'} value={values[key] ?? (kind && key !== 'type' && key !== 'sourceDate' ? kind : '')} onChange={e => set(key, e.target.value)} />}
      </Field>)}
      {path !== 'sources' && <><Field label="מקור נתון"><select value={values.sourceId ?? ''} onChange={e => set('sourceId', e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="">ללא מקור מקושר — תופיע אזהרת איכות</option>{sources.map(source => <option key={source.id} value={source.id}>{source.title}</option>)}</select></Field><Field label="סיווג הנתון"><select value={values.classification} onChange={e => set('classification', e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="FACT">עובדה</option><option value="SOURCE_DATA">נתון מקור</option><option value="ASSUMPTION">הנחה</option><option value="ESTIMATE">אומדן</option><option value="USER_OVERRIDE">שינוי ידני מאושר</option></select></Field><Field label="רמת ודאות"><select value={values.confidence} onChange={e => set('confidence', e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="HIGH">גבוהה</option><option value="MEDIUM">בינונית</option><option value="LOW">נמוכה</option><option value="UNKNOWN">לא ידועה</option></select></Field><label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" checked={values.isVerified === 'true'} onChange={e => set('isVerified', String(e.target.checked))} />אומת מקצועית</label></>}
    </form>}
    {open && <div className="mt-3 flex items-center justify-between gap-3">{mutation.isError ? <span className="text-sm text-destructive" role="alert">{errorText(mutation.error)}</span> : <span /> }<Button size="sm" type="submit" form={`feasibility-${path}`} disabled={mutation.isPending}>{mutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}שמירה</Button></div>}
  </section>
}
