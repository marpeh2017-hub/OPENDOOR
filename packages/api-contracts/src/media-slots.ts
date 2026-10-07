/** Stored in the existing CMS image-slots SETTINGS document. No new entities. */
export interface SiteSlotImage {
  mediaId?: string
  storageKey: string
  alt: { he: string; en?: string }
  classification: 'EDITORIAL_CONTEXT' | 'ARCHITECTURAL_PATTERN' | 'VERIFIED_PROJECT_PHOTO'
}

export interface SiteSlotAssignment extends Partial<SiteSlotImage> {
  /** Ordered list; absent on legacy single-image assignments. */
  slides?: SiteSlotImage[]
  disabled?: boolean
}

export const MAX_SLOT_IMAGES = 8

/**
 * The places on the website whose picture the CRM can change, in page order.
 *
 * Only places the site draws today. Six earlier entries pointed at pictures
 * the site no longer shows and were removed in 2026-10; Michael's photograph
 * was added, which /about shows twice, in its opening and beside his profile.
 * An assignment saved for a removed place stays in the stored document, and
 * nothing on the site reads it.
 */
export const SITE_IMAGE_SLOTS = [
  { id: 'HERO_JERUSALEM_ARCHITECTURE', label: 'דף הבית: גלריית הפתיחה, תמונות מתחלפות', multiple: true },
  { id: 'ABOUT_MICHAEL_PORTRAIT', label: 'מי אנחנו: התמונה של מיכאל רוזנבך', multiple: false },
  ...Array.from({ length: 8 }, (_, i) => ({ id: `PROCESS_STAGE_${i + 1}`, label: `כך אנחנו עובדים: תמונת שלב ${i + 1}`, multiple: false })),
  { id: 'RESIDENT_MEETING', label: 'כך אנחנו עובדים: כנס דיירים', multiple: false },
] as const

/** Read untrusted publications and old single-image documents alike. */
export function slotImages(value: unknown): SiteSlotImage[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return []
  const assignment = value as SiteSlotAssignment
  if (assignment.disabled === true) return []
  const entries: unknown[] = Array.isArray(assignment.slides) ? assignment.slides : [assignment]
  const seen = new Set<string>()
  return entries.filter((entry): entry is SiteSlotImage => {
    if (!entry || typeof entry !== 'object') return false
    const image = entry as SiteSlotImage
    if (typeof image.storageKey !== 'string' || !image.storageKey.trim() ||
        typeof image.alt?.he !== 'string' || !image.alt.he.trim() ||
        !['EDITORIAL_CONTEXT', 'ARCHITECTURAL_PATTERN', 'VERIFIED_PROJECT_PHOTO'].includes(image.classification) ||
        seen.has(image.storageKey)) return false
    seen.add(image.storageKey)
    return true
  }).slice(0, MAX_SLOT_IMAGES)
}

/** Keep the leading image at the old location for backwards compatibility. */
export function assignSlotImages(images: SiteSlotImage[]): SiteSlotAssignment {
  const clean = slotImages({ slides: images })
  return clean.length ? { ...clean[0], slides: clean, disabled: false } : { slides: [], disabled: true }
}
