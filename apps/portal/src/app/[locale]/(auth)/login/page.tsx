import { Shield } from 'lucide-react'
import { OtpLoginForm } from '@/components/auth/otp-login-form'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-teal-50 to-white px-4">
      {/* Logo */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-500 shadow-teal">
          <Shield size={32} className="text-white" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800">OpenDoor</h1>
          <p className="text-sm text-gray-500">התחדשות עירונית</p>
        </div>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-sm">
        <div className="card-surface p-8">
          <div className="mb-6 text-center">
            <h2 className="text-xl font-bold text-gray-800">כניסה לפורטל</h2>
            <p className="text-sm text-gray-500 mt-1">
              הזן את מספר הטלפון שלך לקבלת קוד אימות
            </p>
          </div>
          <OtpLoginForm />
        </div>

        <p className="mt-4 text-center text-xs text-gray-400">
          בכניסה לפורטל אתה מאשר את{' '}
          <a href="/terms" className="underline">תנאי השימוש</a>
          {' '}ואת{' '}
          <a href="/privacy" className="underline">מדיניות הפרטיות</a>
        </p>
      </div>
    </div>
  )
}
