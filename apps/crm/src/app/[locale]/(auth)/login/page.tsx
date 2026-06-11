import { Metadata } from 'next'
import { LoginForm } from '@/components/auth/login-form'

export const metadata: Metadata = { title: 'כניסה' }

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 via-white to-slate-50 px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg mb-4">
            <span className="text-white text-2xl font-black">OD</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">OpenDoor CRM</h1>
          <p className="text-sm text-muted-foreground mt-1">מערכת ניהול התחדשות עירונית</p>
        </div>

        {/* Card */}
        <div className="card-surface p-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-foreground">כניסה למערכת</h2>
            <p className="text-sm text-muted-foreground mt-1">הזן את פרטיך להמשך</p>
          </div>
          <LoginForm />
        </div>

        <p className="text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} OpenDoor התחדשות עירונית · כל הזכויות שמורות
        </p>
      </div>
    </div>
  )
}
