import type { MediaAsset } from '@urban-renewal/api-contracts'

export const illustrationCaption = {"he":"המחשת AI לתהליך התחדשות עירונית; אינה תיעוד של אנשים או פרויקט של החברה.","en":"AI illustration of the urban renewal process; not documentation of company participants or a project."}

// Controlled image assignments: stable stage identity AND title must match.
export const stageImages: Record<string, { title: string; asset: MediaAsset }> = {
  'st-1': { title: "בדיקה ראשונית", asset: { id: 'editorial-stage-1', width: 1200, height: 900, kind: 'image', url: '/images/editorial/stage-1.webp', imageType: 'EDITORIAL_CONTEXT', alt: { he: "המחשת AI: בדיקה ראשונית", en: 'AI illustration: urban renewal stage 1' }, caption: illustrationCaption } },
  'st-2': { title: "היכרות עם בעלי הדירות", asset: { id: 'editorial-stage-2', width: 1200, height: 800, kind: 'image', url: '/images/editorial/stage-2.webp', imageType: 'EDITORIAL_CONTEXT', alt: { he: "המחשת AI: היכרות עם בעלי הדירות", en: 'AI illustration: urban renewal stage 2' }, caption: illustrationCaption } },
  'st-3': { title: "התארגנות ובניית נציגות", asset: { id: 'editorial-stage-3', width: 1200, height: 900, kind: 'image', url: '/images/editorial/stage-3.webp', imageType: 'EDITORIAL_CONTEXT', alt: { he: "המחשת AI: התארגנות ובניית נציגות", en: 'AI illustration: urban renewal stage 3' }, caption: illustrationCaption } },
  'st-4': { title: "איסוף מידע ובדיקות מקצועיות", asset: { id: 'editorial-stage-4', width: 1200, height: 900, kind: 'image', url: '/images/editorial/stage-4.webp', imageType: 'EDITORIAL_CONTEXT', alt: { he: "המחשת AI: איסוף מידע ובדיקות מקצועיות", en: 'AI illustration: urban renewal stage 4' }, caption: illustrationCaption } },
  'st-5': { title: "גיבוש צרכים ועקרונות", asset: { id: 'editorial-stage-5', width: 1200, height: 900, kind: 'image', url: '/images/editorial/stage-5.webp', imageType: 'EDITORIAL_CONTEXT', alt: { he: "המחשת AI: גיבוש צרכים ועקרונות", en: 'AI illustration: urban renewal stage 5' }, caption: illustrationCaption } },
  'st-6': { title: "בחינת חלופות ויזמים", asset: { id: 'editorial-stage-6', width: 1200, height: 900, kind: 'image', url: '/images/editorial/stage-6.webp', imageType: 'EDITORIAL_CONTEXT', alt: { he: "המחשת AI: בחינת חלופות ויזמים", en: 'AI illustration: urban renewal stage 6' }, caption: illustrationCaption } },
  'st-7': { title: "קידום התהליך", asset: { id: 'editorial-stage-7', width: 1200, height: 900, kind: 'image', url: '/images/editorial/stage-7.webp', imageType: 'EDITORIAL_CONTEXT', alt: { he: "המחשת AI: קידום התהליך", en: 'AI illustration: urban renewal stage 7' }, caption: illustrationCaption } },
  'st-8': { title: "ליווי, עדכון ושקיפות לאורך הדרך", asset: { id: 'editorial-stage-8', width: 1200, height: 800, kind: 'image', url: '/images/editorial/stage-8.webp', imageType: 'EDITORIAL_CONTEXT', alt: { he: "המחשת AI: ליווי, עדכון ושקיפות לאורך הדרך", en: 'AI illustration: urban renewal stage 8' }, caption: illustrationCaption } },
}

export const residentMeeting: MediaAsset = {
 id: 'editorial-resident-meeting', width: 1536, height: 1024, kind: 'image', url: '/images/editorial/resident-meeting.png', imageType: 'EDITORIAL_CONTEXT',
 alt: { he: 'המחשת AI של כנס דיירים בירושלים במסגרת תהליך התחדשות עירונית', en: 'AI illustration of a residents meeting in Jerusalem about urban renewal' },
 caption: { he: 'המחשת AI לכנס דיירים בירושלים; אינה תיעוד של אירוע של OpenDoor Group.', en: 'AI illustration of a residents meeting in Jerusalem; not documentation of an OpenDoor Group event.' }
}
