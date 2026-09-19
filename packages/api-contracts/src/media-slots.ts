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
export const SITE_IMAGE_SLOTS = [
  { id: 'HERO_JERUSALEM_ARCHITECTURE', label: 'פתיחת דף הבית — תמונות מתחלפות', multiple: true },
  { id: 'RESIDENT_MEETING', label: 'כנס דיירים — כך אנחנו עובדים', multiple: false },
  { id: 'JERUSALEM_LIGHT_RAIL', label: 'רצועת עיר בעמודי תוכן', multiple: false },
  { id: 'JERUSALEM_CHORDS_BRIDGE', label: 'קריאה לפעולה בסיום הדף', multiple: false },
  { id: 'ABOUT_ISRAELI_RESIDENTIAL', label: 'עמוד מי אנחנו', multiple: false },
  { id: 'RENEWED_ALONGSIDE_EXISTING', label: 'סיום עמוד כך אנחנו עובדים', multiple: false },
  { id: 'JERUSALEM_URBAN_FABRIC', label: 'מרקם עירוני', multiple: false },
  { id: 'ARCHITECTURAL_DETAIL', label: 'פרט אדריכלי', multiple: false },
  ...Array.from({ length: 8 }, (_, i) => ({ id: `PROCESS_STAGE_${i + 1}`, label: `תמונת שלב ${i + 1} — כך אנחנו עובדים`, multiple: false })),
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
