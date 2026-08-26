'use client'

import { useEffect, useRef, useState } from 'react'
// Static CSS import: Next extracts it at build time, so it costs no JS and is
// present before the dynamically-imported library first paints a control.
import 'maplibre-gl/dist/maplibre-gl.css'
import { ISRAEL_DEFAULT_VIEWPORT, resolveMapStyle, type MapMarker } from '@/lib/gis/map-provider'

/**
 * The ONLY module in the CRM that imports MapLibre.
 *
 * Everything above it speaks in `MapMarker[]` and a click callback, so
 * swapping the renderer means rewriting this file and nothing else. MapLibre
 * itself is loaded through a dynamic `import()` inside an effect: the library
 * touches `window` at module scope and would break server rendering otherwise,
 * and this keeps ~800KB of map code out of the bundle for every page that is
 * not the map.
 *
 * Notes on the tile layer:
 *   - Standard OSM raster tiles: no key, no account, no per-view billing.
 *   - Labels are baked into raster tiles, so Hebrew renders correctly with no
 *     RTL text plugin (that plugin is only needed for vector label shaping).
 *   - Attribution is rendered by MapLibre's own control and is required by the
 *     OSM tile usage policy.
 */

export interface MapCanvasProps {
  markers: MapMarker[]
  /** Marker currently highlighted, e.g. from the result list. */
  selectedId?: string | null
  onMarkerClick?: (marker: MapMarker) => void
  className?: string
}

const KIND_COLOR: Record<string, string> = {
  PROJECT: '#2F9DA0',
  COMPLEX: '#7C3AED',
  BUILDING: '#F59E0B',
}

export function MapCanvas({ markers, selectedId, onMarkerClick, className }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const markerObjectsRef = useRef<Map<string, any>>(new Map())
  const libRef = useRef<any>(null)
  // Held in a ref so re-renders don't need to tear down and rebind the map.
  const onClickRef = useRef(onMarkerClick)
  onClickRef.current = onMarkerClick

  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)

  // ── Create the map once ────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    const container = containerRef.current
    if (!container) return

    ;(async () => {
      try {
        const maplibre = await import('maplibre-gl')
        if (cancelled) return

        libRef.current = maplibre
        const map = new maplibre.Map({
          container,
          style: resolveMapStyle() as never,
          center: [ISRAEL_DEFAULT_VIEWPORT.center.lng, ISRAEL_DEFAULT_VIEWPORT.center.lat],
          zoom: ISRAEL_DEFAULT_VIEWPORT.zoom,
          attributionControl: { compact: true },
        })
        map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-left')
        map.on('load', () => {
          if (!cancelled) setReady(true)
        })
        map.on('error', (e: any) => {
          // A tile that fails to load must not blank the whole screen.
          console.warn('[MapCanvas] map error', e?.error?.message ?? e)
        })
        mapRef.current = map
      } catch (err) {
        if (!cancelled) {
          // Degrade honestly: the caller still renders the result list, so the
          // data remains reachable without the map.
          setFailed((err as Error).message || 'failed to load map library')
        }
      }
    })()

    return () => {
      cancelled = true
      markerObjectsRef.current.forEach((m) => m.remove())
      markerObjectsRef.current.clear()
      mapRef.current?.remove()
      mapRef.current = null
      setReady(false)
    }
  }, [])

  // ── Sync markers ───────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    const maplibre = libRef.current
    if (!map || !maplibre || !ready) return

    markerObjectsRef.current.forEach((m) => m.remove())
    markerObjectsRef.current.clear()

    for (const marker of markers) {
      const el = document.createElement('button')
      el.type = 'button'
      el.setAttribute('aria-label', marker.label)
      el.title = marker.label
      el.style.cssText = [
        'width:18px', 'height:18px', 'border-radius:9999px', 'cursor:pointer',
        'border:2px solid #fff', 'box-shadow:0 1px 4px rgba(0,0,0,.35)', 'padding:0',
        `background:${KIND_COLOR[marker.kind] ?? '#2F9DA0'}`,
      ].join(';')
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        onClickRef.current?.(marker)
      })

      const popup = new maplibre.Popup({ offset: 14, closeButton: false }).setText(marker.label)
      const obj = new maplibre.Marker({ element: el })
        .setLngLat([marker.lng, marker.lat])
        .setPopup(popup)
        .addTo(map)
      markerObjectsRef.current.set(marker.id, obj)
    }

    // Fit to the data. A single marker has no extent to fit, so centre on it at
    // a street-level zoom instead of letting fitBounds pick something absurd.
    if (markers.length === 1) {
      map.easeTo({ center: [markers[0].lng, markers[0].lat], zoom: 15, duration: 400 })
    } else if (markers.length > 1) {
      const bounds = new maplibre.LngLatBounds()
      markers.forEach((m) => bounds.extend([m.lng, m.lat]))
      map.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: 400 })
    }
  }, [markers, ready])

  // ── Fly to the selected marker ─────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !selectedId) return
    const marker = markers.find((m) => m.id === selectedId)
    if (!marker) return
    map.easeTo({ center: [marker.lng, marker.lat], zoom: 16, duration: 500 })
    markerObjectsRef.current.get(selectedId)?.togglePopup?.()
  }, [selectedId, markers, ready])

  if (failed) {
    return (
      <div className={className}>
        <div className="flex h-full min-h-[320px] items-center justify-center rounded-xl border border-border bg-muted/30 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            לא ניתן לטעון את שכבת המפה. הרשימה שלהלן מציגה את אותן הישויות.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <div
        ref={containerRef}
        role="application"
        aria-label="מפת פרויקטים"
        className="h-full min-h-[420px] w-full overflow-hidden rounded-xl border border-border"
        // MapLibre measures its own container; it must have a real height
        // before `load` fires or the canvas comes out zero-sized.
        style={{ minHeight: 420 }}
      />
    </div>
  )
}
