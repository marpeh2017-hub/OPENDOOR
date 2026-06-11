'use client'

import { useState } from 'react'
import { User, Phone, Mail, Home, Bell, Shield, LogOut, ChevronLeft, Moon, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'

const resident = {
  name:    'ישראל ישראלי',
  phone:   '054-8018613',
  email:   'israel@example.com',
  address: 'הרצל 45, דירה 7, תל אביב',
  avatar:  'יי',
}

function ProfileRow({
  icon: Icon,
  label,
  value,
  action,
}: {
  icon: React.ElementType
  label: string
  value: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors">
      <div className="h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
        <Icon size={15} className="text-gray-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm font-medium text-gray-800 truncate">{value}</p>
      </div>
      {action}
    </div>
  )
}

function SettingRow({
  icon: Icon,
  label,
  sub,
  right,
}: {
  icon: React.ElementType
  label: string
  sub?: string
  right?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors cursor-pointer">
      <div className="h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
        <Icon size={15} className="text-gray-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
      {right ?? <ChevronLeft size={15} className="text-gray-300 flex-shrink-0" />}
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={cn(
        'relative h-5 w-9 rounded-full transition-colors flex-shrink-0',
        checked ? 'bg-teal-500' : 'bg-gray-300'
      )}
    >
      <span className={cn(
        'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
        checked ? 'translate-x-4' : 'translate-x-0.5'
      )} />
    </button>
  )
}

export default function ProfilePage() {
  const [notifPush, setNotifPush]     = useState(true)
  const [notifEmail, setNotifEmail]   = useState(true)
  const [notifSms, setNotifSms]       = useState(false)
  const [darkMode, setDarkMode]       = useState(false)

  return (
    <div className="space-y-5 pb-10">
      {/* Avatar + name */}
      <div className="card-surface p-5 flex items-center gap-4">
        <div className="h-16 w-16 rounded-2xl bg-teal-500 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
          {resident.avatar}
        </div>
        <div>
          <p className="text-lg font-bold text-gray-800">{resident.name}</p>
          <p className="text-sm text-teal-600">דייר פרויקט הרצל 45</p>
          <p className="text-xs text-gray-400 mt-0.5">מזהה: RES-00124</p>
        </div>
      </div>

      {/* Personal details */}
      <div className="card-surface overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-gray-50/50">
          <h2 className="text-sm font-semibold text-gray-700">פרטים אישיים</h2>
        </div>
        <div className="divide-y divide-border">
          <ProfileRow icon={Phone} label="טלפון"         value={resident.phone} />
          <ProfileRow icon={Mail}  label="אימייל"         value={resident.email} />
          <ProfileRow icon={Home}  label="כתובת דירה"     value={resident.address} />
        </div>
      </div>

      {/* Notifications */}
      <div className="card-surface overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-gray-50/50">
          <h2 className="text-sm font-semibold text-gray-700">הגדרות התראות</h2>
        </div>
        <div className="divide-y divide-border">
          <SettingRow icon={Bell} label="התראות Push"   sub="עדכונים מיידיים"   right={<Toggle checked={notifPush}  onChange={() => setNotifPush(p => !p)}  />} />
          <SettingRow icon={Mail} label="עדכונים במייל" sub="סיכומים שבועיים"   right={<Toggle checked={notifEmail} onChange={() => setNotifEmail(p => !p)} />} />
          <SettingRow icon={Phone}label="SMS"           sub="תזכורות חשובות"    right={<Toggle checked={notifSms}   onChange={() => setNotifSms(p => !p)}   />} />
        </div>
      </div>

      {/* Preferences */}
      <div className="card-surface overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-gray-50/50">
          <h2 className="text-sm font-semibold text-gray-700">העדפות</h2>
        </div>
        <div className="divide-y divide-border">
          <SettingRow icon={Moon}   label="מצב כהה"       right={<Toggle checked={darkMode} onChange={() => setDarkMode(p => !p)} />} />
          <SettingRow icon={Globe}  label="שפה"           sub="עברית" />
          <SettingRow icon={Shield} label="אבטחה ופרטיות" />
        </div>
      </div>

      {/* Logout */}
      <button className="w-full card-surface p-4 flex items-center justify-center gap-2 text-red-500 hover:bg-red-50 transition-colors font-medium text-sm">
        <LogOut size={16} />
        התנתק
      </button>

      <p className="text-center text-xs text-gray-300">OpenDoor Portal v1.0.0</p>
    </div>
  )
}
