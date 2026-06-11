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
          <a href="/he/forgot-password" className="text-xs text-primary hover:underline">
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

      <Button type="submit" disabled={loading || !email || !password} className="w-full h-11 gap-2 text-base">
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
