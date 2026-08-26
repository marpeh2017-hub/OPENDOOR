'use client'

import { useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useSendCommunication } from '@/hooks/use-communications'
import { useResidents } from '@/hooks/use-residents'
import { CHANNEL_CFG } from './communications-log'

/** Channels the CRM can actually originate a message on. */
const SENDABLE = ['WHATSAPP', 'SMS', 'EMAIL'] as const

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultResidentId?: string
}

export function NewMessageDialog({ open, onOpenChange, defaultResidentId }: Props) {
  const [channel, setChannel]       = useState<string>('WHATSAPP')
  const [residentId, setResidentId] = useState(defaultResidentId ?? '')
  const [subject, setSubject]       = useState('')
  const [body, setBody]             = useState('')

  const { data: residents } = useResidents({ limit: 200 })
  const send = useSendCommunication()

  const resident = useMemo(
    () => residents?.data.find(r => r.id === residentId) ?? null,
    [residents, residentId],
  )

  const isEmail = channel === 'EMAIL'
  // A resident with no address on the chosen channel cannot be messaged.
  const contact = isEmail ? resident?.email : resident?.phone
  const canSend = Boolean(residentId && body.trim() && contact) && !send.isPending

  function reset() {
    setChannel('WHATSAPP'); setResidentId(defaultResidentId ?? '')
    setSubject(''); setBody(''); send.reset()
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSend || !resident) return

    send.mutate(
      {
        channel,
        residentId,
        body: body.trim(),
        ...(isEmail && subject.trim() ? { subject: subject.trim() } : {}),
        ...(isEmail ? { toEmail: resident.email ?? undefined } : { toPhone: resident.phone ?? undefined }),
      },
      { onSuccess: () => { reset(); onOpenChange(false) } },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) reset(); onOpenChange(next) }}>
      <DialogContent className="sm:max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">הודעה חדשה</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>ערוץ</Label>
            <Select value={channel} onValueChange={setChannel} dir="rtl">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SENDABLE.map(c => (
                  <SelectItem key={c} value={c}>{CHANNEL_CFG[c].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>נמען *</Label>
            <Select value={residentId} onValueChange={setResidentId} dir="rtl">
              <SelectTrigger><SelectValue placeholder="בחרו דייר" /></SelectTrigger>
              <SelectContent>
                {residents?.data.map(r => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.firstName} {r.lastName}
                    {r.apartment?.apartmentNumber ? ` — דירה ${r.apartment.apartmentNumber}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {residentId && !contact && (
              <p className="text-xs text-amber-600">
                {isEmail ? 'לדייר זה אין כתובת אימייל רשומה' : 'לדייר זה אין מספר טלפון רשום'}
              </p>
            )}
            {resident?.doNotContact && (
              <p className="text-xs text-red-600">הדייר סימן בקשה לא ליצור קשר</p>
            )}
          </div>

          {isEmail && (
            <div className="space-y-1.5">
              <Label htmlFor="msg-subject">נושא</Label>
              <Input
                id="msg-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="נושא ההודעה"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="msg-body">תוכן ההודעה *</Label>
            <textarea
              id="msg-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="כתבו את ההודעה..."
            />
          </div>

          {send.isError && (
            <p className="text-sm text-red-600" role="alert">
              {send.error instanceof Error ? send.error.message : 'שליחת ההודעה נכשלה'}
            </p>
          )}

          <DialogFooter className="gap-2 sm:justify-start">
            <Button type="submit" disabled={!canSend}>
              {send.isPending && <Loader2 size={15} className="animate-spin ml-1.5" />}
              שליחה
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              ביטול
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
