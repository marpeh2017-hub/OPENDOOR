import Link from 'next/link'
import { MapPin, Users, CheckCircle2, ArrowLeft } from 'lucide-react'

const featuredProjects = [
  {
    id: '1',
    name: 'רחוב הרצל 45',
    city: 'תל אביב',
    stage: 'חתימות',
    stageColor: 'bg-purple-100 text-purple-700',
    residents: 48,
    signatureRate: 71,
    imgPlaceholder: 'TLV',
  },
  {
    id: '2',
    name: 'שד׳ בן גוריון 12',
    city: 'חיפה',
    stage: 'בנייה',
    stageColor: 'bg-green-100 text-green-700',
    residents: 120,
    signatureRate: 94,
    imgPlaceholder: 'HFA',
  },
  {
    id: '3',
    name: 'רחוב ויצמן 8',
    city: 'ירושלים',
    stage: 'תכנון',
    stageColor: 'bg-cyan-100 text-cyan-700',
    residents: 65,
    signatureRate: 83,
    imgPlaceholder: 'JLM',
  },
]

export function ProjectsSection() {
  return (
    <section className="py-20 bg-white">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="flex items-end justify-between mb-10">
          <div>
            <h2 className="text-3xl font-black text-gray-900 mb-2">פרויקטים נבחרים</h2>
            <p className="text-gray-600">חלק מהפרויקטים שאנחנו מנהלים</p>
          </div>
          <Link
            href="/projects"
            className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-teal-500 hover:text-teal-600"
          >
            כל הפרויקטים <ArrowLeft size={15} />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {featuredProjects.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="card-surface overflow-hidden hover:shadow-lg transition-shadow group"
            >
              {/* Image placeholder */}
              <div className="flex h-40 items-center justify-center bg-gradient-to-br from-teal-50 to-teal-100 text-5xl font-black text-teal-200 group-hover:from-teal-100 transition-colors">
                {p.imgPlaceholder}
              </div>

              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-800">{p.name}</h3>
                    <div className="flex items-center gap-1 text-sm text-gray-500 mt-0.5">
                      <MapPin size={13} />
                      {p.city}
                    </div>
                  </div>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${p.stageColor}`}>
                    {p.stage}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <Users size={14} className="text-gray-400" />
                    {p.residents} דיירים
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircle2 size={14} className="text-teal-500" />
                    {p.signatureRate}% חתמו
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
