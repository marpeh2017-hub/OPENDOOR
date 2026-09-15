'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'

interface GalleryImage { id: string; src: string; alt: string }
interface Labels { gallery: string; previous: string; next: string; pause: string; play: string; image: string }

/** One CMS-ordered gallery. Pause on interaction, offscreen, hidden tab or reduced motion. */
export function ImageGallery({ images, labels, priority = false }: {
  images: GalleryImage[]; labels: Labels; priority?: boolean
}) {
  const root = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [visible, setVisible] = useState(false)
  const [pageVisible, setPageVisible] = useState(true)
  const [reduced, setReduced] = useState(true)
  const [failed, setFailed] = useState<string[]>([])
  const slides = images.filter((image) => !failed.includes(image.src))
  const current = slides.length ? index % slides.length : 0

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const motion = () => setReduced(preference.matches)
    const visibility = () => setPageVisible(!document.hidden)
    motion(); visibility()
    preference.addEventListener('change', motion)
    document.addEventListener('visibilitychange', visibility)
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.15 })
    if (root.current) observer.observe(root.current)
    return () => {
      preference.removeEventListener('change', motion)
      document.removeEventListener('visibilitychange', visibility)
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    if (slides.length < 2 || paused || hovered || reduced || !visible || !pageVisible) return
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % slides.length), 6000)
    return () => window.clearInterval(timer)
  }, [slides.length, paused, hovered, reduced, visible, pageVisible])

  if (!slides.length) return null
  const choose = (value: number) => { setPaused(true); setIndex((value + slides.length) % slides.length) }
  const buttonClass = 'inline-flex h-11 w-11 items-center justify-center rounded-sm text-white transition-opacity duration-200 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-white [@media(hover:hover)_and_(pointer:fine)]:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
  const iconClass = 'rounded-sm bg-black/60 p-1'
  return (
    <div ref={root} role="region" aria-roledescription="carousel" aria-label={labels.gallery}
      className="group relative overflow-hidden bg-surface-sunken"
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onFocusCapture={(event) => { if (!(event.target as HTMLElement).closest('[data-playback]')) setPaused(true) }}>
      <div className="relative h-[280px] sm:h-[380px] lg:h-[min(52vw,570px)]">
        {slides.map((image, position) => (
          <div key={image.id} aria-hidden={position !== current}
            className={`absolute inset-0 transition-opacity duration-700 motion-reduce:transition-none ${position === current ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
            {image.src.startsWith('/images/') ? (
              <Image src={image.src} alt={image.alt} fill sizes="100vw" priority={priority && position === 0}
                className="object-cover" onError={() => setFailed((old) => [...old, image.src])} />
            ) : (
              // Managed storage URLs expire and must not be cached by Next's image proxy.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image.src} alt={image.alt} className="h-full w-full object-cover"
                loading={position === 0 ? 'eager' : 'lazy'} onError={() => setFailed((old) => [...old, image.src])} />
            )}
          </div>
        ))}
      </div>
      {slides.length > 1 && (
        <>
          <button type="button" className={`${buttonClass} absolute start-1 top-1/2 -translate-y-1/2 sm:start-3`} aria-label={labels.previous} onClick={() => choose(current - 1)}><ChevronLeft aria-hidden="true" className={`${iconClass} rtl:rotate-180`} size={26} /></button>
          <span className="sr-only" aria-live={paused ? 'polite' : 'off'}>{labels.image} {current + 1} / {slides.length}</span>
          <button type="button" className={`${buttonClass} absolute end-1 top-1/2 -translate-y-1/2 sm:end-3`} aria-label={labels.next} onClick={() => choose(current + 1)}><ChevronRight aria-hidden="true" className={`${iconClass} rtl:rotate-180`} size={26} /></button>
          {!reduced && <button data-playback type="button" className={`${buttonClass} absolute bottom-1 end-1 sm:bottom-2 sm:end-3`} aria-label={paused ? labels.play : labels.pause} onClick={() => setPaused((value) => !value)}>{paused ? <Play aria-hidden="true" className={iconClass} size={24} /> : <Pause aria-hidden="true" className={iconClass} size={24} />}</button>}
        </>
      )}
    </div>
  )
}
