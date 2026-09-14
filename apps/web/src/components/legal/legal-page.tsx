import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { legalLastUpdated } from '@/lib/company'

/**
 * Highlights an unfilled placeholder so it cannot be missed during review.
 * Renders plainly once the value in company.ts no longer contains "[[".
 */
export function Placeholder({ children }: { children: string }) {
  if (!children.includes('[[')) return <>{children}</>
  return (
    <mark className="rounded bg-warning-50 px-1 py-0.5 font-semibold text-warning-700">
      {children}
    </mark>
  )
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-xl font-bold text-gray-800">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-gray-700">{children}</div>
    </section>
  )
}

export function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc space-y-2 ps-5 text-sm leading-relaxed text-gray-700">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  )
}

export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string
  intro?: string
  children: React.ReactNode
}) {
  return (
    <>
      <Header />
      <main id="main-content">
        <div className="border-b border-border bg-gray-50">
          <div className="mx-auto max-w-3xl px-4 py-12 lg:px-8">
            <h1 className="mb-3 text-3xl font-black text-gray-900 lg:text-4xl">{title}</h1>
            {intro && <p className="text-base leading-relaxed text-gray-700">{intro}</p>}
            <p className="mt-4 text-xs text-gray-600">עודכן לאחרונה: {legalLastUpdated}</p>
          </div>
        </div>

        <div className="mx-auto max-w-3xl px-4 py-12 lg:px-8">
          <div className="mb-8 rounded-lg border border-warning-500/30 bg-warning-50 px-4 py-3 text-sm text-warning-700">
            <strong>טיוטה לעיון משפטי.</strong> מסמך זה הוא נוסח ראשוני שטרם נבדק על ידי עורך דין
            ואינו מחייב. אין להסתמך עליו כל עוד הודעה זו מוצגת.
          </div>
          {children}
        </div>
      </main>
      <Footer />
    </>
  )
}
