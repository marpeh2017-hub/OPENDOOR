'use client'

import { useState } from 'react'
import { Send, Bell, Megaphone, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

type MsgType = 'ANNOUNCEMENT' | 'PERSONAL' | 'SYSTEM'

const TYPE_CFG: Record<MsgType, { icon: React.ElementType; bg: string; cls: string }> = {
  ANNOUNCEMENT: { icon: Megaphone,    bg: 'bg-teal-50',   cls: 'text-teal-600' },
  PERSONAL:     { icon: MessageSquare,bg: 'bg-blue-50',   cls: 'text-blue-600' },
  SYSTEM:       { icon: Bell,          bg: 'bg-gray-50',  cls: 'text-gray-500' },
}

const messages = [
  { id: '1', type: 'ANNOUNCEMENT' as MsgType, from: 'OpenDoor', subject: 'עדכון: אישור עקרוני מהעירייה התקבל', body: 'שלום לכל דיירי פרויקט הרצל 45. אנו שמחים לבשר כי קיבלנו אישור עקרוני מהעירייה לתוכנית הבנייה. הפרויקט ממשיך לפי לוח הזמנים.', date: '08.04.2024', read: false },
  { id: '2', type: 'PERSONAL'     as MsgType, from: 'אבי שמואלי', subject: 'תזכורת: פגישה עדכון ב-20.07', body: 'שלום, רצינו לתזכר אותך לפגישת עדכון דיירים שתתקיים ב-20 ליולי ב-18:00. ניתן להצטרף גם בזום.', date: '15.07.2024', read: false },
  { id: '3', type: 'SYSTEM'       as MsgType, from: 'מערכת', subject: 'ההסכם שלך נחתם בהצלחה', body: 'ההסכם לפרויקט הרצל 45 נחתם ב-15.03.2024. עותק מלא נשלח לכתובת האימייל שלך.', date: '15.03.2024', read: true },
  { id: '4', type: 'ANNOUNCEMENT' as MsgType, from: 'OpenDoor', subject: 'הזמנה: הצגת תוכניות אדריכלות', body: 'אנו מזמינים אתכם לערב הצגת תוכניות האדריכלות לפרויקט. ב-05.05.2024 בשעה 18:30 במרכז הקהילתי.', date: '28.04.2024', read: true },
]

export default function MessagesPage() {
  const [selected, setSelected] = useState<typeof messages[0] | null>(null)
  const [newMsg, setNewMsg] = useState('')
  const unread = messages.filter(m => !m.read).length

  if (selected) {
    const cfg = TYPE_CFG[selected.type]
    const Icon = cfg.icon
    return (
      <div className="pb-10">
        <button onClick={() => setSelected(null)} className="flex items-center gap-1.5 text-sm text-teal-600 mb-4">
          ← חזור
        </button>
        <div className="card-surface p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className={cn('h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0', cfg.bg)}>
              <Icon size={18} className={cfg.cls} />
            </div>
            <div>
              <p className="font-semibold text-gray-800">{selected.subject}</p>
              <p className="text-xs text-gray-400 mt-0.5">מ: {selected.from} · {selected.date}</p>
            </div>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed border-t border-border pt-4">
            {selected.body}
          </p>
        </div>

        {selected.type === 'PERSONAL' && (
          <div className="mt-4 card-surface p-3 flex gap-2">
            <input
              value={newMsg}
              onChange={e => setNewMsg(e.target.value)}
              placeholder="כתוב תגובה..."
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-gray-400"
              dir="rtl"
            />
            <button
              disabled={!newMsg.trim()}
              className="h-8 w-8 rounded-lg bg-teal-500 text-white flex items-center justify-center disabled:opacity-40"
            >
              <Send size={14} />
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">הודעות</h1>
          {unread > 0 && <p className="text-sm text-teal-600">{unread} הודעות שלא נקראו</p>}
        </div>
      </div>

      <div className="card-surface divide-y divide-border overflow-hidden">
        {messages.map(msg => {
          const cfg = TYPE_CFG[msg.type]
          const Icon = cfg.icon
          return (
            <button
              key={msg.id}
              onClick={() => setSelected(msg)}
              className="w-full flex items-start gap-3 px-4 py-4 hover:bg-gray-50 transition-colors text-right"
            >
              <div className={cn('h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5', cfg.bg)}>
                <Icon size={16} className={cfg.cls} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <p className={cn('text-sm font-medium truncate', msg.read ? 'text-gray-600' : 'text-gray-900')}>
                    {msg.subject}
                  </p>
                  <span className="text-xs text-gray-400 flex-shrink-0">{msg.date}</span>
                </div>
                <p className="text-xs text-gray-400 truncate">{msg.body}</p>
              </div>
              {!msg.read && (
                <div className="h-2 w-2 rounded-full bg-teal-500 flex-shrink-0 mt-2" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
