import { Quote } from 'lucide-react'

const testimonials = [
  {
    id: '1',
    name: 'שרה כהן',
    project: 'רחוב הרצל 45, תל אביב',
    text: 'הצוות של OpenDoor ליווה אותנו בכל שלב. הם היו שקופים לגמרי ותמיד זמינים לכל שאלה. לא האמנתי שפרויקט כזה יכול להיות כל כך חלק.',
    initials: 'שכ',
  },
  {
    id: '2',
    name: 'דוד לוי',
    project: 'שד׳ בן גוריון 12, חיפה',
    text: 'קיבלנו דירה חדשה פי שניים וחצי גדולה מהמקורית. הם עמדו בכל ההבטחות ובכל הלוחות זמנים. ממליץ בחום לכל שכן.',
    initials: 'דל',
  },
  {
    id: '3',
    name: 'מרים אברהם',
    project: 'רחוב ויצמן 8, ירושלים',
    text: 'הפורטל הדיגיטלי שלהם עזר לי לעקוב אחרי ההתקדמות בכל רגע. לא הייתי צריכה להתקשר כל שבוע לשאול מה קורה.',
    initials: 'מא',
  },
]

export function TestimonialsSection() {
  return (
    <section className="py-20 bg-teal-50">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-black text-gray-900 mb-3">מה אומרים הדיירים</h2>
          <p className="text-gray-600">חוויות אמיתיות של דיירים שעברנו איתם את הדרך</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <div key={t.id} className="card-surface p-6">
              <Quote size={28} className="text-teal-200 mb-4" />
              <p className="text-gray-700 leading-relaxed mb-5 text-sm">{t.text}</p>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 text-teal-700 font-bold text-sm">
                  {t.initials}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{t.name}</p>
                  <p className="text-xs text-gray-500">{t.project}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
