'use client'

import { useState } from 'react'
import { Send, Phone, MessageSquare, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type MsgChannel = 'WHATSAPP' | 'SMS' | 'EMAIL' | 'CALL'

const CHANNEL_CFG: Record<MsgChannel, { label: string; cls: string }> = {
  WHATSAPP: { label: 'וואטסאפ', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  SMS:      { label: 'SMS',      cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  EMAIL:    { label: 'אימייל',   cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  CALL:     { label: 'שיחה',     cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
}

const mockMessages = [
  { id: '1', channel: 'WHATSAPP' as MsgChannel, direction: 'OUT', text: 'שלום דוד, אנחנו מזמינים אותך לפגישת הצגת תוכנית הפינוי-בינוי ברחוב הרצל 45. האם יום שלישי ב-18:00 מתאים?', date: '10.01.2024 09:15', sender: 'אבי שמואלי' },
  { id: '2', channel: 'WHATSAPP' as MsgChannel, direction: 'IN',  text: 'שלום, כן זה מתאים לי. אשמח לשמוע פרטים.', date: '10.01.2024 11:32', sender: 'דוד כהן' },
  { id: '3', channel: 'EMAIL'    as MsgChannel, direction: 'OUT', text: 'שלום דוד, בהמשך לשיחתנו, מצורפת טיוטת ההסכם לעיונך. אנא עבור עליה ושלח שאלות אם יש.', date: '18.02.2024 14:00', sender: 'אבי שמואלי' },
  { id: '4', channel: 'CALL'     as MsgChannel, direction: 'OUT', text: 'שיחת טלפון – דיון על סעיפי ההסכם. משך: 23 דקות.', date: '25.02.2024 10:45', sender: 'שרה מזרחי' },
  { id: '5', channel: 'SMS'      as MsgChannel, direction: 'OUT', text: 'תזכורת: מחר ב-10:00 פגישת חתימה במשרד הנוטריון. כתובת: המלך ג\'ורג\' 12, רמת גן.', date: '14.03.2024 18:00', sender: 'מערכת' },
]

export function ResidentMessagesTab({ residentId }: { residentId: string }) {
  const [message, setMessage] = useState('')

  return (
    <div className="space-y-4">
      {/* Channel quick-actions */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="gap-2 h-8 text-xs">
          <MessageSquare size={12} className="text-green-600" /> וואטסאפ
        </Button>
        <Button variant="outline" size="sm" className="gap-2 h-8 text-xs">
          <MessageSquare size={12} className="text-blue-600" /> SMS
        </Button>
        <Button variant="outline" size="sm" className="gap-2 h-8 text-xs">
          <Mail size={12} className="text-purple-600" /> אימייל
        </Button>
        <Button variant="outline" size="sm" className="gap-2 h-8 text-xs">
          <Phone size={12} className="text-amber-600" /> רישום שיחה
        </Button>
      </div>

      {/* Message thread */}
      <div className="card-surface divide-y divide-border overflow-hidden">
        {mockMessages.map(msg => {
          const channel = CHANNEL_CFG[msg.channel]
          const isOut = msg.direction === 'OUT'
          return (
            <div key={msg.id} className="px-4 py-3.5 hover:bg-muted/20">
              <div className="flex items-center justify-between gap-4 mb-1.5">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'text-xs font-medium px-2 py-0.5 rounded-full',
                    channel.cls
                  )}>
                    {channel.label}
                  </span>
                  <span className={cn(
                    'text-xs',
                    isOut ? 'text-primary' : 'text-muted-foreground'
                  )}>
                    {isOut ? `← ${msg.sender}` : `→ ${msg.sender}`}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0">{msg.date}</span>
              </div>
              <p className="text-sm text-foreground/80 leading-relaxed">{msg.text}</p>
            </div>
          )
        })}
      </div>

      {/* Quick send */}
      <div className="card-surface p-3 flex gap-2">
        <input
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="כתוב הודעה..."
          className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
          dir="rtl"
        />
        <Button size="sm" className="gap-1.5 h-8" disabled={!message.trim()}>
          <Send size={13} /> שלח
        </Button>
      </div>
    </div>
  )
}
