'use client'

import { useState } from 'react'
import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

const STEPS = [
  { id: 1, label: 'פרטי פרויקט' },
  { id: 2, label: 'צוות' },
  { id: 3, label: 'הגדרות' },
]

const STAGES = [
  { value: 'DISCOVERY',             label: 'גילוי' },
  { value: 'FEASIBILITY',           label: 'היתכנות' },
  { value: 'RESIDENT_ORGANIZATION', label: 'התארגנות דיירים' },
  { value: 'SIGNATURES',            label: 'חתימות' },
]

const CITIES = ['תל אביב', 'ירושלים', 'חיפה', 'ראשון לציון', 'פתח תקווה', 'בני ברק', 'אשדוד', 'רמת גן', 'חולון', 'רחובות']

interface FormData {
  name: string
  address: string
  city: string
  neighborhood: string
  totalUnits: string
  stage: string
  startDate: string
  targetDate: string
  projectManager: string
  lawyer: string
  architect: string
  notes: string
  signatureThreshold: string
  notifyResidents: boolean
}

const initialForm: FormData = {
  name: '', address: '', city: '', neighborhood: '', totalUnits: '',
  stage: 'DISCOVERY', startDate: '', targetDate: '',
  projectManager: '', lawyer: '', architect: '', notes: '',
  signatureThreshold: '67', notifyResidents: true,
}

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((step, idx) => (
        <div key={step.id} className="flex items-center gap-2">
          <div className={cn(
            'h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all',
            current > step.id
              ? 'bg-primary border-primary text-white'
              : current === step.id
              ? 'border-primary text-primary bg-primary/10'
              : 'border-border text-muted-foreground bg-background',
          )}>
            {current > step.id ? <Check size={14} /> : step.id}
          </div>
          <span className={cn(
            'text-sm font-medium hidden sm:block',
            current === step.id ? 'text-foreground' : 'text-muted-foreground'
          )}>
            {step.label}
          </span>
          {idx < STEPS.length - 1 && (
            <div className={cn(
              'h-px w-8 mx-1',
              current > step.id ? 'bg-primary' : 'bg-border'
            )} />
          )}
        </div>
      ))}
    </div>
  )
}

function Step1({ form, set }: { form: FormData; set: (k: keyof FormData, v: string) => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label className="form-label">שם הפרויקט *</Label>
          <Input value={form.name} onChange={e => set('name', e.target.value)}
            placeholder='למשל: "הרצל 45 תל אביב"' dir="rtl" />
        </div>
        <div>
          <Label className="form-label">כתובת *</Label>
          <Input value={form.address} onChange={e => set('address', e.target.value)}
            placeholder="רחוב ומספר" dir="rtl" />
        </div>
        <div>
          <Label className="form-label">עיר *</Label>
          <Select value={form.city} onValueChange={v => set('city', v)}>
            <SelectTrigger dir="rtl"><SelectValue placeholder="בחר עיר" /></SelectTrigger>
            <SelectContent>
              {CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="form-label">שכונה</Label>
          <Input value={form.neighborhood} onChange={e => set('neighborhood', e.target.value)}
            placeholder="שם השכונה" dir="rtl" />
        </div>
        <div>
          <Label className="form-label">מספר יחידות דיור *</Label>
          <Input type="number" value={form.totalUnits} onChange={e => set('totalUnits', e.target.value)}
            placeholder="24" dir="rtl" />
        </div>
        <div>
          <Label className="form-label">שלב נוכחי</Label>
          <Select value={form.stage} onValueChange={v => set('stage', v)}>
            <SelectTrigger dir="rtl"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STAGES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="form-label">תאריך התחלה</Label>
          <Input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} dir="ltr" />
        </div>
        <div>
          <Label className="form-label">תאריך יעד</Label>
          <Input type="date" value={form.targetDate} onChange={e => set('targetDate', e.target.value)} dir="ltr" />
        </div>
      </div>
    </div>
  )
}

function Step2({ form, set }: { form: FormData; set: (k: keyof FormData, v: string) => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="form-label">מנהל פרויקט *</Label>
          <Select value={form.projectManager} onValueChange={v => set('projectManager', v)}>
            <SelectTrigger dir="rtl"><SelectValue placeholder="בחר מנהל" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="avi">אבי שמואלי</SelectItem>
              <SelectItem value="sara">שרה מזרחי</SelectItem>
              <SelectItem value="moshe">משה לוי</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="form-label">עורך דין</Label>
          <Input value={form.lawyer} onChange={e => set('lawyer', e.target.value)}
            placeholder='עו"ד שם משפחה' dir="rtl" />
        </div>
        <div className="col-span-2">
          <Label className="form-label">אדריכל / מתכנן</Label>
          <Input value={form.architect} onChange={e => set('architect', e.target.value)}
            placeholder="שם האדריכל" dir="rtl" />
        </div>
        <div className="col-span-2">
          <Label className="form-label">הערות ראשוניות</Label>
          <textarea
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            placeholder="מידע נוסף על הפרויקט..."
            rows={4}
            dir="rtl"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
          />
        </div>
      </div>
    </div>
  )
}

function Step3({ form, set }: { form: FormData; set: (k: keyof FormData, v: string) => void }) {
  return (
    <div className="space-y-6">
      <div>
        <Label className="form-label">סף חתימות (%) לקידום שלב</Label>
        <p className="text-xs text-muted-foreground mb-2">
          המערכת תתריע כאשר אחוז החתימות יעבור את הסף הזה
        </p>
        <div className="flex items-center gap-4">
          {[51, 60, 67, 75, 80].map(v => (
            <button
              key={v}
              onClick={() => set('signatureThreshold', String(v))}
              className={cn(
                'h-10 w-14 rounded-lg border text-sm font-semibold transition-all',
                form.signatureThreshold === String(v)
                  ? 'border-primary bg-primary text-white'
                  : 'border-border text-foreground hover:border-primary/50'
              )}
            >
              {v}%
            </button>
          ))}
        </div>
      </div>

      <div className="card-surface p-4 space-y-3">
        <h4 className="text-sm font-semibold text-foreground">סיכום הפרויקט</h4>
        {[
          ['שם',           form.name || '—'],
          ['כתובת',        [form.address, form.city].filter(Boolean).join(', ') || '—'],
          ['יחידות',       form.totalUnits ? `${form.totalUnits} דירות` : '—'],
          ['שלב פתיחה',    STAGES.find(s => s.value === form.stage)?.label ?? '—'],
          ['מנהל פרויקט',  form.projectManager || '—'],
          ['סף חתימות',    `${form.signatureThreshold}%`],
        ].map(([label, value]) => (
          <div key={label} className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium text-foreground">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function NewProjectWizard({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormData>(initialForm)

  function setField(key: keyof FormData, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function handleSubmit() {
    // TODO: POST to API
    console.log('Creating project:', form)
    onClose()
    setStep(1)
    setForm(initialForm)
  }

  function handleClose() {
    onClose()
    setTimeout(() => { setStep(1); setForm(initialForm) }, 300)
  }

  const canNext = step === 1
    ? Boolean(form.name && form.address && form.city && form.totalUnits)
    : step === 2
    ? Boolean(form.projectManager)
    : true

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">פרויקט חדש</DialogTitle>
        </DialogHeader>

        <StepIndicator current={step} />

        <div className="min-h-72">
          {step === 1 && <Step1 form={form} set={setField} />}
          {step === 2 && <Step2 form={form} set={setField} />}
          {step === 3 && <Step3 form={form} set={setField} />}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-border mt-6">
          <Button
            variant="outline"
            onClick={() => step > 1 ? setStep(s => s - 1) : handleClose()}
            className="gap-2"
          >
            <ChevronRight size={15} />
            {step === 1 ? 'ביטול' : 'הקודם'}
          </Button>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            שלב {step} מתוך {STEPS.length}
          </div>
          {step < STEPS.length ? (
            <Button onClick={() => setStep(s => s + 1)} disabled={!canNext} className="gap-2">
              הבא
              <ChevronLeft size={15} />
            </Button>
          ) : (
            <Button onClick={handleSubmit} className="gap-2 bg-primary hover:bg-primary/90">
              <Check size={15} />
              צור פרויקט
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
