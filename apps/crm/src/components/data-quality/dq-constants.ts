import type { DqCategory, DqSeverity, DqStatus } from '@/hooks/use-data-quality'

export const SEVERITY_CFG: Record<DqSeverity, { label: string; badge: string; dot: string; order: number }> = {
  CRITICAL: { label: 'קריטי',  badge: 'bg-red-100 text-red-700 border-red-200',        dot: 'bg-red-600',    order: 0 },
  HIGH:     { label: 'גבוה',   badge: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-500', order: 1 },
  MEDIUM:   { label: 'בינוני', badge: 'bg-amber-100 text-amber-700 border-amber-200',  dot: 'bg-amber-500',  order: 2 },
  LOW:      { label: 'נמוך',   badge: 'bg-blue-100 text-blue-700 border-blue-200',     dot: 'bg-blue-500',   order: 3 },
  INFO:     { label: 'מידע',   badge: 'bg-gray-100 text-gray-600 border-gray-200',     dot: 'bg-gray-400',   order: 4 },
}

export const STATUS_CFG: Record<DqStatus, { label: string; badge: string }> = {
  OPEN:        { label: 'פתוח',      badge: 'bg-red-50 text-red-700 border-red-200' },
  IN_PROGRESS: { label: 'בטיפול',    badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  RESOLVED:    { label: 'טופל',      badge: 'bg-green-50 text-green-700 border-green-200' },
  IGNORED:     { label: 'הוסתר',     badge: 'bg-gray-100 text-gray-600 border-gray-200' },
}

export const CATEGORY_LABEL: Record<DqCategory, string> = {
  COMPLETENESS: 'שלמות נתונים',
  ACCURACY:     'דיוק נתונים',
  CONSISTENCY:  'עקביות',
  INTEGRITY:    'תקינות קשרים',
  DUPLICATION:  'כפילויות',
  TIMELINESS:   'עדכניות',
  COMPLIANCE:   'עמידה בדרישות',
}

export const ENTITY_LABEL: Record<string, string> = {
  PROJECT:           'פרויקט',
  COMPLEX:           'מתחם',
  BUILDING:          'בניין',
  APARTMENT:         'דירה',
  OWNER:             'בעלים',
  OWNER_APARTMENT:   'רישום בעלות',
  RESIDENT:          'דייר',
  SIGNATURE_PACKAGE: 'חבילת חתימה',
  SIGNATURE_RECORD:  'רשומת חתימה',
  DOCUMENT:          'מסמך',
  TASK:              'משימה',
  MESSAGE:           'הודעה',
  MEETING:           'פגישה',
  LEAD:              'ליד',
  USER:              'משתמש',
}

export function scoreTone(score: number): { text: string; bar: string; label: string } {
  if (score >= 90) return { text: 'text-green-600',  bar: 'bg-green-500',  label: 'מצוין' }
  if (score >= 75) return { text: 'text-teal-600',   bar: 'bg-teal-500',   label: 'טוב' }
  if (score >= 50) return { text: 'text-amber-600',  bar: 'bg-amber-500',  label: 'דורש טיפול' }
  return { text: 'text-red-600', bar: 'bg-red-500', label: 'קריטי' }
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('he-IL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('he-IL', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000))
}
