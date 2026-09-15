'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowRight, Plus, Trash2, RefreshCw, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api-client'

interface SignerEntry {
  ownerId: string
  apartmentId: string
  signerRole: string
  required: boolean
}

const SIGNER_ROLES = ['OWNER', 'CO_OWNER', 'REPRESENTATIVE', 'ATTORNEY', 'GUARDIAN', 'COMPANY_REP', 'ESTATE_REP']
const ROLE_LABELS: Record<string, string> = {
  OWNER:          'בעלים',
  CO_OWNER:       'שותף בעלות',
  REPRESENTATIVE: 'מיופה כוח',
  ATTORNEY:       'עורך דין',
  GUARDIAN:       'אפוטרופוס',
  COMPANY_REP:    'נציג חברה',
  ESTATE_REP:     'נציג עיזבון',
}

export default function NewPackagePage() {
  const router = useRouter()
  const locale = (useParams().locale as string) ?? 'he'

  const [title,              setTitle]              = useState('')
  const [projectId,          setProjectId]          = useState('')
  const [signingOrder,       setSigningOrder]        = useState('PARALLEL')
  const [verificationMethod, setVerificationMethod]  = useState('SMS_OTP')
  const [expiresAt,          setExpiresAt]           = useState('')
  const [signers,            setSigners]             = useState<SignerEntry[]>([
    { ownerId: '', apartmentId: '', signerRole: 'OWNER', required: true },
  ])
  const [loading, setLoading]  = useState(false)
  const [error,   setError]    = useState<string | null>(null)

  function addSigner() {
    setSigners(prev => [...prev, { ownerId: '', apartmentId: '', signerRole: 'OWNER', required: true }])
  }

  function removeSigner(idx: number) {
    setSigners(prev => prev.filter((_, i) => i !== idx))
  }

  function updateSigner(idx: number, field: keyof SignerEntry, value: string | boolean) {
    setSigners(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !projectId.trim()) {
      setError('שם החבילה ומזהה הפרויקט נדרשים')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const body: any = {
        title:              title.trim(),
        projectId:          projectId.trim(),
        signingOrder,
        verificationMethod,
        signers: signers.filter(s => s.ownerId && s.apartmentId).map(s => ({
          ownerId:      s.ownerId.trim(),
          apartmentId:  s.apartmentId.trim(),
          signerRole:   s.signerRole,
          required:     s.required,
        })),
      }
      if (expiresAt) body.expiresAt = expiresAt

      const pkg = await api.post<{ id: string }>('/signatures/packages', body)
      // localePrefix is 'always', so the locale segment must be explicit.
      router.push(`/${locale}/signatures/${pkg.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'שגיאה ביצירת החבילה')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowRight size={18} />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-foreground">חבילת חתימות חדשה</h1>
          <p className="text-sm text-muted-foreground">מלא את הפרטים ושלח לחתימה</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Package details */}
      <div className="card-surface p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">פרטי החבילה</h2>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">שם החבילה *</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="לדוגמה: הסכם פינוי בינוי — רחוב הרצל 45"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">מזהה פרויקט *</label>
          <input
            type="text"
            value={projectId}
            onChange={e => setProjectId(e.target.value)}
            placeholder="מזהה הפרויקט"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">סדר חתימה</label>
            <select
              value={signingOrder}
              onChange={e => setSigningOrder(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="PARALLEL">מקביל</option>
              <option value="SEQUENTIAL">סדרתי</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">שיטת אימות</label>
            <select
              value={verificationMethod}
              onChange={e => setVerificationMethod(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="SMS_OTP">SMS OTP</option>
              <option value="EMAIL_LINK">קישור לאימייל</option>
              <option value="COMBINED">משולב</option>
              <option value="NONE">ללא</option>
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">תאריך תפוגה (אופציונלי)</label>
          <input
            type="date"
            value={expiresAt}
            onChange={e => setExpiresAt(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {/* Signers */}
      <div className="card-surface overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold">חותמים</h2>
          <Button type="button" variant="outline" size="sm" onClick={addSigner} className="h-7 text-xs gap-1.5">
            <Plus size={12} />
            הוסף חותם
          </Button>
        </div>

        <div className="divide-y divide-border">
          {signers.map((signer, idx) => (
            <div key={idx} className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">חותם {idx + 1}</p>
                {signers.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSigner(idx)}
                    className="text-destructive/60 hover:text-destructive"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">מזהה בעלים</label>
                  <input
                    type="text"
                    value={signer.ownerId}
                    onChange={e => updateSigner(idx, 'ownerId', e.target.value)}
                    placeholder="Owner ID"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">מזהה דירה</label>
                  <input
                    type="text"
                    value={signer.apartmentId}
                    onChange={e => updateSigner(idx, 'apartmentId', e.target.value)}
                    placeholder="Apartment ID"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex-1 space-y-1">
                  <label className="text-xs text-muted-foreground">תפקיד חותם</label>
                  <select
                    value={signer.signerRole}
                    onChange={e => updateSigner(idx, 'signerRole', e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {SIGNER_ROLES.map(r => (
                      <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer mt-4">
                  <input
                    type="checkbox"
                    checked={signer.required}
                    onChange={e => updateSigner(idx, 'required', e.target.checked)}
                    className="rounded border-border"
                  />
                  חובה
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legal disclaimer */}
      <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800 space-y-1">
        <p className="font-semibold">הצהרה משפטית</p>
        <p>
          חתימה אלקטרונית זו מבוצעת בהתאם לחוק חתימה אלקטרונית, התשס&quot;א-2001.
          אימות OTP בהודעת SMS מהווה חתימה אלקטרונית רגילה המוכרת בדין.
        </p>
      </div>

      {/* Submit */}
      <div className="flex gap-3 justify-end">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          ביטול
        </Button>
        <Button type="submit" disabled={loading}>
          {loading
            ? <RefreshCw size={14} className="animate-spin ml-1" />
            : <Send size={14} className="ml-1" />
          }
          צור חבילה
        </Button>
      </div>
    </form>
  )
}
