'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, LogIn, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [showPass, setShowPass]   = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.message ?? 'שם משתמש או סיסמה שגויים')
        return
      }

      // Redirect to dashboard
      router.push('/he')
      router.refresh()
    } catch {
      setError('שגיאת חיבור — נסה שוב')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" dir="rtl">
      <div>
        <Label className="form-label">אימייל</Label>
        <Input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="name@company.co.il"
          required
          autoComplete="email"
          dir="ltr"
          className="h-11"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <Label className="form-label mb-0">סיסמה</Label>
          {/* teal-600 rather than the primary teal-500: at 12px this link needs
              4.5:1 and teal-500 gives 3.26:1 on white. teal-600 is 5.12:1. */}
          <a href="/he/forgot-password" className="text-xs text-teal-600 hover:underline">
            שכחת סיסמה?
          </a>
        </div>
        <div className="relative">
          <Input
            type={showPass ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="הזן סיסמה"
            required
            autoComplete="current-password"
            className="h-11 pe-10"
          />
          <button
            type="button"
            onClick={() => setShowPass(p => !p)}
            className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
          <p className="text-sm text-destructive font-medium">{error}</p>
        </div>
      )}

      {/*
        teal-600, not the default primary teal-500: white on teal-500 is 3.25:1
        and this 16px label needs 4.5:1. The `--primary` token itself is
        teal-500 with a white foreground, so EVERY primary button in the CRM
        carries the same 3.25:1 — fixing that is a brand-level decision and a
        separate change, so the override is scoped to this button.
      */}
      <Button
        type="submit"
        disabled={loading || !email || !password}
        className="w-full h-11 gap-2 text-base bg-teal-600 hover:bg-teal-700"
      >
        {loading
          ? <><Loader2 size={16} className="animate-spin" /> מתחבר...</>
          : <><LogIn size={16} /> כניסה</>
        }
      </Button>

      {/* Demo credentials hint */}
      <div className="bg-muted/40 rounded-lg px-4 py-3 text-xs text-muted-foreground space-y-1">
        <p className="font-semibold text-foreground/60">דמו:</p>
        <p>אימייל: <span className="font-mono">admin@opendoor.co.il</span></p>
        <p>סיסמה: <span className="font-mono">demo1234</span></p>
      </div>
    </form>
  )
}
