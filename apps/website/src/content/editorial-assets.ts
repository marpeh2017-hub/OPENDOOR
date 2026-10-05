import type { MediaAsset } from '@urban-renewal/api-contracts'

// Controlled image assignments: stable stage identity AND title must match.
// Alt text is the stage each image stands for. No caption: these are
// placeholders until the company's own photographs replace them.
export const stageImages: Record<string, { title: string; asset: MediaAsset }> = {
  'st-1': { title: "בדיקה ראשונית", asset: { id: 'editorial-stage-1', width: 1200, height: 900, kind: 'image', url: '/images/editorial/stage-1.webp', imageType: 'EDITORIAL_CONTEXT', alt: { he: "בדיקה ראשונית", en: 'First review' } } },
  'st-2': { title: "היכרות עם בעלי הדירות", asset: { id: 'editorial-stage-2', width: 1200, height: 800, kind: 'image', url: '/images/editorial/stage-2.webp', imageType: 'EDITORIAL_CONTEXT', alt: { he: "היכרות עם בעלי הדירות", en: 'Meeting the owners' } } },
  'st-3': { title: "התארגנות ובניית נציגות", asset: { id: 'editorial-stage-3', width: 1200, height: 900, kind: 'image', url: '/images/editorial/stage-3.webp', imageType: 'EDITORIAL_CONTEXT', alt: { he: "התארגנות ובניית נציגות", en: 'Organising and forming a representation' } } },
  'st-4': { title: "איסוף מידע ובדיקות מקצועיות", asset: { id: 'editorial-stage-4', width: 1200, height: 900, kind: 'image', url: '/images/editorial/stage-4.webp', imageType: 'EDITORIAL_CONTEXT', alt: { he: "איסוף מידע ובדיקות מקצועיות", en: 'Gathering information and professional review' } } },
  'st-5': { title: "גיבוש צרכים ועקרונות", asset: { id: 'editorial-stage-5', width: 1200, height: 900, kind: 'image', url: '/images/editorial/stage-5.webp', imageType: 'EDITORIAL_CONTEXT', alt: { he: "גיבוש צרכים ועקרונות", en: 'Setting out needs and principles' } } },
  'st-6': { title: "בחינת חלופות ויזמים", asset: { id: 'editorial-stage-6', width: 1200, height: 900, kind: 'image', url: '/images/editorial/stage-6.webp', imageType: 'EDITORIAL_CONTEXT', alt: { he: "בחינת חלופות ויזמים", en: 'Examining alternatives and developers' } } },
  'st-7': { title: "קידום התהליך", asset: { id: 'editorial-stage-7', width: 1200, height: 900, kind: 'image', url: '/images/editorial/stage-7.webp', imageType: 'EDITORIAL_CONTEXT', alt: { he: "קידום התהליך", en: 'Advancing the process' } } },
  'st-8': { title: "ליווי, עדכון ושקיפות לאורך הדרך", asset: { id: 'editorial-stage-8', width: 1200, height: 800, kind: 'image', url: '/images/editorial/stage-8.webp', imageType: 'EDITORIAL_CONTEXT', alt: { he: "ליווי, עדכון ושקיפות לאורך הדרך", en: 'Support, updates and transparency throughout' } } },
}

export const residentMeeting: MediaAsset = {
 id: 'editorial-resident-meeting', width: 1536, height: 1024, kind: 'image', url: '/images/editorial/resident-meeting.webp', imageType: 'EDITORIAL_CONTEXT',
 alt: { he: 'כנס בעלי דירות בירושלים במסגרת תהליך התחדשות עירונית', en: 'A residents meeting in Jerusalem about urban renewal' },
}
