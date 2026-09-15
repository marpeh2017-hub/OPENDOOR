import type { MediaAsset } from '@urban-renewal/api-contracts'
import { getCmsImageSlots, getPublicMediaUrl } from '@/lib/cms-source'
import { residentMeeting } from '@/content/editorial-assets'

/**
 * ══════════════════════════════════════════════════════════════════════════
 *  THE IMAGE INVENTORY
 * ══════════════════════════════════════════════════════════════════════════
 *
 * The repository contains no image assets. This file is the ORDER FORM: every
 * photographic slot on the homepage, specified precisely enough that a
 * photographer or a picture editor can fulfil it without another conversation.
 *
 * ── HOW A SLOT BECOMES A PHOTOGRAPH ────────────────────────────────────────
 *
 * Each slot has `asset: null`. The renderer draws the OpenDoor architectural
 * graphic named in `fallback` while that is true. Supplying an image is one
 * edit — set `asset` to a `MediaAsset` — and nothing else changes: no layout
 * work, no component change, no aspect-ratio surprise, because the slot's
 * ratios are declared here and the renderer already reserves that space.
 *
 * ── WHY EVERY SLOT DECLARES WHAT IT MAY CLAIM ──────────────────────────────
 *
 * `claim` is the value the eventual asset MUST carry. Two of these slots are
 * `EDITORIAL_CONTEXT`: they show real Jerusalem that OpenDoor did not build,
 * design, own or manage. The renderer prints their caption visibly and
 * unconditionally for exactly that reason — a picture of the Chords Bridge on
 * a company's homepage will be read as the company's work unless the page says
 * otherwise, and no reader should have to guess.
 *
 * NO SLOT ON THIS PAGE IS `VERIFIED_PROJECT_PHOTO`. None has been verified.
 * Project cards therefore render the deterministic pattern, and will keep doing
 * so until somebody confirms a photograph depicts the building it sits under.
 */

export interface ImageSlotSpec {
  /** Stable id, used as the inventory key and in the brief to a photographer. */
  id: string
  /** What the image is doing on the page — not what it depicts. */
  purpose: string
  orientation: 'landscape' | 'portrait' | 'panoramic'
  /** Rendered aspect ratio at each breakpoint. The renderer reserves this box
   *  before the image loads, which is what prevents layout shift. */
  desktopRatio: string
  mobileRatio: string
  /** Shortest acceptable long edge, in pixels, for a 2× display. */
  minResolution: string
  /** What the alt text has to convey. The alt itself ships with the asset. */
  altIntent: string
  /** What the image is permitted to claim once supplied. */
  claim: 'VERIFIED_PROJECT_PHOTO' | 'EDITORIAL_CONTEXT' | 'ARCHITECTURAL_PATTERN'
  /** Direction for whoever sources it, including what to avoid. */
  direction: string
  /** The OpenDoor graphic drawn until an asset exists. */
  fallback: 'hillside' | 'chords-bridge' | 'light-rail' | 'pattern'
  /** null until a licensed asset is supplied. */
  asset: MediaAsset | null
}

export const IMAGE_SLOTS: Record<string, ImageSlotSpec> = {
  RESIDENT_MEETING: {
    id: 'RESIDENT_MEETING', purpose: 'Editorial image in the designated process-page media position.',
    orientation: 'landscape', desktopRatio: '16 / 9', mobileRatio: '4 / 3', minResolution: '1600 × 900',
    altIntent: 'A residents meeting shown as an illustrative image, never a verified event.',
    claim: 'EDITORIAL_CONTEXT', direction: 'Community residents meeting; no claim of a real OpenDoor event.',
    fallback: 'pattern', asset: residentMeeting,
  },
  /* ── 1 ── HERO ───────────────────────────────────────────────────────── */
  HERO_JERUSALEM_ARCHITECTURE: {
    id: 'HERO_JERUSALEM_ARCHITECTURE',
    purpose:
      'The first thing a visitor sees, revealed through the OpenDoor threshold. Establishes place and subject before a word is read.',
    orientation: 'portrait',
    desktopRatio: '3 / 4',
    mobileRatio: '16 / 10',
    minResolution: '1600 × 2133 (desktop 2×); a separate 1200 × 750 crop for mobile',
    altIntent:
      'Describe the residential fabric shown: stone-faced apartment buildings on a Jerusalem hillside, without naming a project or implying OpenDoor involvement.',
    claim: 'EDITORIAL_CONTEXT',
    direction:
      'Contemporary Jerusalem RESIDENTIAL architecture: stone-faced apartment blocks, balconies, the stepped hillside density. Daylight, flat or overcast, no golden hour. Must NOT be: the Old City, a tourist viewpoint, a luxury tower, a construction site with cranes, or a CGI render. The subject is where people live, not what a visitor photographs.',
    fallback: 'hillside',
    asset: {
      id: 'editorial-jerusalem-stone-view', kind: 'image',
      url: '/images/editorial/jerusalem-stone-view.webp', imageType: 'EDITORIAL_CONTEXT',
      alt: { he: 'המחשת AI של מרקם מגורים ירושלמי מבעד לקירות אבן', en: 'AI illustration of Jerusalem housing seen between stone walls' },
      caption: { he: 'להמחשה בלבד', en: 'For illustration only' },
      focalPoint: { x: 50, y: 65 },
    },
  },

  /* ── 2 ── CITY BAND, between the process and the projects ────────────── */
  JERUSALEM_LIGHT_RAIL: {
    id: 'JERUSALEM_LIGHT_RAIL',
    purpose:
      'A full-bleed band marking the turn from "how the process works" to "where we work". Carries the idea that the city itself is changing.',
    orientation: 'panoramic',
    desktopRatio: '21 / 9',
    mobileRatio: '3 / 2',
    minResolution: '2400 × 1030',
    altIntent:
      'The light rail running along a Jerusalem street between residential buildings: city context, explicitly not an OpenDoor project.',
    claim: 'EDITORIAL_CONTEXT',
    direction:
      'The tram IN ITS STREET: track, catenary, residential frontage either side, ordinary people. The train should occupy a small part of the frame. Must NOT be a promotional close-up of a tram, an empty platform, or anything that reads as a transport advertisement.',
    fallback: 'light-rail',
    asset: null,
  },

  /* ── 3 ── THE CLOSING ────────────────────────────────────────────────── */
  JERUSALEM_CHORDS_BRIDGE: {
    id: 'JERUSALEM_CHORDS_BRIDGE',
    purpose:
      'Seen through the closing threshold: the city on the other side of the process. The page’s one landmark, used once.',
    orientation: 'landscape',
    desktopRatio: '2 / 1',
    mobileRatio: '4 / 3',
    minResolution: '2000 × 1000',
    altIntent:
      'The Chords Bridge as structure (mast and cables) as a Jerusalem landmark. Must not suggest OpenDoor built, designed or manages it.',
    claim: 'EDITORIAL_CONTEXT',
    direction:
      'ARCHITECTURAL photography: the mast, the cable geometry, the deck, ideally with the city behind it. Overcast or blue-hour flat light. Must NOT be a sunset postcard, a long-exposure light-trail shot, or a symmetrical centred monument portrait. Emphasis on structure and infrastructure, not on spectacle.',
    fallback: 'chords-bridge',
    asset: null,
  },

  /* ── 4 ── /about ─────────────────────────────────────────────────────── */
  ABOUT_ISRAELI_RESIDENTIAL: {
    id: 'ABOUT_ISRAELI_RESIDENTIAL',
    purpose:
      'Gives the company page physical reality. /about with no image at all reads as a policy document rather than as a company that works on real buildings.',
    orientation: 'landscape',
    desktopRatio: '3 / 2',
    mobileRatio: '4 / 3',
    minResolution: '1800 × 1200',
    altIntent:
      'Contemporary Israeli residential buildings. Describe the fabric shown without naming a place, a project, or implying OpenDoor involvement.',
    claim: 'EDITORIAL_CONTEXT',
    direction:
      'Contemporary ISRAELI residential architecture, deliberately NOT city-specific: apartment blocks, balconies, ordinary urban density. This slot exists to carry the national positioning, so anything unmistakably Jerusalem belongs in the homepage slots instead. Daylight, flat or overcast. Must NOT be: a luxury tower, a marketing render, a construction site, or an empty styled street.',
    fallback: 'hillside',
    asset: null,
  },

  /* ── 5 ── /how-we-work ───────────────────────────────────────────────── */
  RENEWED_ALONGSIDE_EXISTING: {
    id: 'RENEWED_ALONGSIDE_EXISTING',
    purpose:
      'Closes the process journey. The one subject that actually depicts urban renewal rather than merely a building: what the eight stages lead to.',
    orientation: 'panoramic',
    desktopRatio: '21 / 9',
    mobileRatio: '3 / 2',
    minResolution: '2400 × 1030',
    altIntent:
      'Existing residential buildings beside newer construction, showing a neighbourhood partway through renewal. City context, not an OpenDoor project.',
    claim: 'EDITORIAL_CONTEXT',
    direction:
      'Existing and renewed construction IN THE SAME FRAME, with the seam between them visible. That contrast is the whole subject. Must NOT be a finished development photographed alone, a before-and-after pair, or a render. Ordinary daylight; residents and parked cars are welcome.',
    fallback: 'pattern',
    asset: null,
  },

  /* ── 6 ── RESERVE, not placed on any page yet ────────────────────────── */
  JERUSALEM_URBAN_FABRIC: {
    id: 'JERUSALEM_URBAN_FABRIC',
    purpose:
      'Held in reserve for the knowledge section or an interior page. NOT placed on the homepage: the page already has three photographic moments and a fourth would cost it its quiet stretch.',
    orientation: 'landscape',
    desktopRatio: '16 / 9',
    mobileRatio: '4 / 3',
    minResolution: '1800 × 1013',
    altIntent: 'An ordinary Jerusalem residential street, the everyday fabric of the city.',
    claim: 'EDITORIAL_CONTEXT',
    direction:
      'A residential street: entrances, balconies, parked cars, stone. Deliberately unglamorous. Must NOT be styled, staged or emptied of people.',
    fallback: 'pattern',
    asset: null,
  },

  /* ── 7 ── RESERVE DETAIL, not placed on any page yet ─────────────────── */
  ARCHITECTURAL_DETAIL: {
    id: 'ARCHITECTURAL_DETAIL',
    purpose:
      'A close material note: where Jerusalem stone meets contemporary construction. Reserved for an interior page.',
    orientation: 'portrait',
    desktopRatio: '3 / 4',
    mobileRatio: '1 / 1',
    minResolution: '1200 × 1600',
    altIntent: 'A detail where stone facing meets newer construction on a residential building.',
    claim: 'EDITORIAL_CONTEXT',
    direction:
      'Tight, material, honest: a balcony edge, an entrance, a junction between old stone and new work. Must NOT be an abstract texture with no architectural subject.',
    fallback: 'pattern',
    asset: null,
  },
}

/**
 * Reads a slot, CMS assignment first — Pass 4G.
 *
 * Returns the full spec either way, so the renderer can draw the fallback
 * when `asset` is null without knowing whether that null came from "nobody
 * has assigned an image yet" or "the CMS is unreachable". A CMS assignment
 * overrides `asset` only; `desktopRatio`/`mobileRatio`/`minResolution` and
 * every other production instruction stay exactly as specified here; an
 * editor picks WHICH photograph, never how it is laid out.
 *
 * Async because of the CMS lookup — see `getCmsImageSlots` for why that is
 * one request for all seven slots rather than one per slot.
 */
export async function getImageSlot(id: keyof typeof IMAGE_SLOTS): Promise<ImageSlotSpec> {
  const spec = IMAGE_SLOTS[id]
  const assigned = (await getCmsImageSlots())[id]
  if (!assigned) return spec

  // Resolved to a real, fetchable URL HERE, server-side, so the renderer
  // (`EditorialImage`) needs no CMS awareness at all — it already knows how
  // to draw an `asset` or fall back to the pattern, and that is unchanged.
  const url = await getPublicMediaUrl(assigned.storageKey)
  if (!url) return spec // signing failed; behave exactly as if unassigned

  const asset: MediaAsset = {
    id: assigned.storageKey,
    kind: 'image',
    url,
    alt: assigned.alt,
    imageType: assigned.classification as MediaAsset['imageType'],
  }
  return { ...spec, asset }
}

/** Slots still waiting on a licensed asset. Used by the review report; also the
 *  thing to check before claiming the photography work is finished. */
export function pendingImageSlots(): ImageSlotSpec[] {
  return Object.values(IMAGE_SLOTS).filter((slot) => slot.asset === null)
}
