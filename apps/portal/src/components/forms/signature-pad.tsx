'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Eraser } from 'lucide-react'

/** The exported image's width: enough for a signature, small enough to send. */
const EXPORT_WIDTH = 600

/**
 * A signature drawn with a finger, a stylus or a mouse, exported as a PNG
 * data URL (10-30KB at 600px wide, under the gateway's cap). `touch-action:
 * none` keeps the page from scrolling while a finger draws.
 *
 * Drawing is not possible for everyone; the text beside the pad says so and
 * offers signing on paper instead.
 */
export function SignaturePad({
  id,
  describedBy,
  onChange,
}: {
  id: string
  describedBy?: string
  onChange: (dataUrl: string | null) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const [empty, setEmpty] = useState(true)

  const context = useCallback(() => canvasRef.current?.getContext('2d') ?? null, [])

  // The bitmap matches the drawn size times the pixel ratio, so the line is
  // sharp on a phone; resizing clears it, as a new pad would be.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const fit = () => {
      const ratio = Math.max(1, window.devicePixelRatio || 1)
      const { width, height } = canvas.getBoundingClientRect()
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.scale(ratio, ratio)
      ctx.lineWidth = 2.4
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = '#14312F'
      setEmpty(true)
      onChange(null)
    }
    fit()
    const observer = new ResizeObserver(() => fit())
    observer.observe(canvas)
    return () => observer.disconnect()
    // onChange is a setter from the parent; refitting on its identity would clear the pad.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const exportImage = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const out = document.createElement('canvas')
    out.width = EXPORT_WIDTH
    out.height = Math.round((canvas.height / canvas.width) * EXPORT_WIDTH)
    out.getContext('2d')?.drawImage(canvas, 0, 0, out.width, out.height)
    onChange(out.toDataURL('image/png'))
  }

  return (
    <div className="space-y-2">
      <canvas
        id={id}
        ref={canvasRef}
        role="img"
        aria-label="אזור החתימה"
        aria-describedby={describedBy}
        className="block h-40 w-full touch-none rounded-lg border-2 border-dashed border-gray-300 bg-white"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          drawing.current = true
          last.current = point(e)
          const ctx = context()
          if (ctx && last.current) {
            ctx.beginPath()
            ctx.arc(last.current.x, last.current.y, 1.1, 0, Math.PI * 2)
            ctx.fillStyle = '#14312F'
            ctx.fill()
          }
        }}
        onPointerMove={(e) => {
          if (!drawing.current || !last.current) return
          const ctx = context()
          const next = point(e)
          if (ctx) {
            ctx.beginPath()
            ctx.moveTo(last.current.x, last.current.y)
            ctx.lineTo(next.x, next.y)
            ctx.stroke()
          }
          last.current = next
          if (empty) setEmpty(false)
        }}
        onPointerUp={() => {
          if (!drawing.current) return
          drawing.current = false
          last.current = null
          setEmpty(false)
          exportImage()
        }}
        onPointerCancel={() => {
          drawing.current = false
          last.current = null
        }}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">{empty ? 'חתמו כאן באצבע או בעכבר' : 'החתימה נקלטה'}</span>
        <button
          type="button"
          onClick={() => {
            const canvas = canvasRef.current
            const ctx = context()
            if (canvas && ctx) {
              ctx.save()
              ctx.setTransform(1, 0, 0, 1, 0, 0)
              ctx.clearRect(0, 0, canvas.width, canvas.height)
              ctx.restore()
            }
            setEmpty(true)
            onChange(null)
          }}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-gray-600 hover:bg-gray-100"
        >
          <Eraser size={15} aria-hidden="true" />
          ניקוי
        </button>
      </div>
    </div>
  )
}
