'use client'

import { useEffect, useRef, useState } from 'react'
import { MessageCircle, Send, X } from 'lucide-react'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const STORAGE_KEY = 'odg-faq-chat-history'
const GREETING = 'שלום! אני כאן לענות על שאלות בנושא התחדשות עירונית. במה אוכל לעזור?'
const UNAVAILABLE_MESSAGE = 'נסה שוב מאוחר יותר.'

function loadHistory(): ChatMessage[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveHistory(messages: ChatMessage[]) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
  } catch {
    // sessionStorage unavailable (private mode, quota) — chat still works,
    // it just won't survive a reload.
  }
}

/**
 * Floating FAQ chat widget for the marketing site's /faq page.
 *
 * The conversation lives only in sessionStorage — nothing is sent to a
 * database, so it disappears with the tab. `/api/faq-chat` is the only
 * network call; it holds the Anthropic API key server-side.
 */
export function FaqChatWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const history = loadHistory()
    setMessages(history.length > 0 ? history : [{ role: 'assistant', content: GREETING }])
  }, [])

  useEffect(() => {
    if (messages.length > 0) saveHistory(messages)
  }, [messages])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages, loading])

  async function sendMessage() {
    const text = input.trim()
    if (!text || loading) return

    const next: ChatMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    setLoading(true)
    setError(false)

    try {
      const response = await fetch('/api/faq-chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      })

      if (!response.ok) {
        setError(true)
        return
      }

      const data = (await response.json()) as { reply?: string }
      if (!data.reply) {
        setError(true)
        return
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply! }])
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void sendMessage()
    }
  }

  return (
    <div dir="rtl" className="fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6">
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="צ'אט שאלות ותשובות"
          className="mb-3 flex h-[70vh] max-h-[560px] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-gray-200 bg-teal-900 px-4 py-3 text-white">
            <span className="text-sm font-semibold">שוחח איתנו</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="סגור צ'אט"
              className="rounded-full p-1 text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-[14px] leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-gray-100 text-gray-900'
                      : 'bg-teal-50 text-teal-950'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl bg-teal-50 px-3 py-2 text-[14px] text-teal-900">
                  <span className="inline-flex gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-500 [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-500 [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-500" />
                  </span>
                </div>
              </div>
            )}
            {error && (
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl bg-red-50 px-3 py-2 text-[14px] text-red-700">
                  {UNAVAILABLE_MESSAGE}
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 p-3">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder="הקלד/י שאלה..."
                aria-label="הודעה לצ'אט"
                disabled={loading}
                className="max-h-24 flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2 text-[14px] text-right focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600 disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => void sendMessage()}
                disabled={loading || !input.trim()}
                aria-label="שלח הודעה"
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-teal-700 text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? 'סגור צ\'אט' : 'שוחח איתנו'}
        className="flex items-center gap-2 rounded-full bg-teal-700 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-teal-800"
      >
        <MessageCircle size={18} />
        <span>שוחח איתנו</span>
      </button>
    </div>
  )
}
