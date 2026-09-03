'use client'

import { AlertTriangle, Check, FileSearch, MapPin, X } from 'lucide-react'
import { PrivateBanner, Section, Callout, Row } from './fields'
import { SOURCE_TYPE_LABEL, QUALITY_LABEL, REVIEW_STATE_LABEL, type ProjectDocument } from './types'

/**
 * מידע פנימי — the project's real workspace.
 *
 * ── THIS TAB HAS NO PUBLISHING ACTION, ON PURPOSE ──────────────────────────
 *
 * Not "the publish button is hidden here". There is no control on this tab,
 * and no field in this subtree, that any publication path reads: the gateway's
 * `projectProjection` never reads `internal` at all. So the promise in the
 * banner is a statement about the architecture rather than about this screen's
 * buttons, and it stays true if somebody later adds a button by mistake.
 *
 * ── WHY THE CANDIDATE ADDRESSES ARE THE CENTREPIECE ────────────────────────
 *
 * For Tchernichovsky the boundary IS the open question. Ten addresses appear
 * in the workbook, one more (טשרניחובסקי 42) conspicuously does not, and a
 * parcel exists whose address nobody can resolve. Presenting that as a settled
 * list with a map would answer the question by drawing it. So it is presented
 * as what it is: candidates, with the one absence written down explicitly.
 */
export function TabInternal({ doc }: { doc: ProjectDocument }) {
  const internal = doc.internal ?? {}
  const candidates = internal.candidateAddresses ?? []
  const inWorkbook = candidates.filter((c) => c.inWorkbook)
  const notInWorkbook = candidates.filter((c) => !c.inWorkbook)
  const flags = internal.dataQualityFlags ?? []
  const blocking = flags.filter((f) => !f.resolved && f.severity === 'BLOCKING')
  const nonBlocking = flags.filter((f) => !f.resolved && f.severity !== 'BLOCKING')

  const empty =
    candidates.length === 0 && (internal.blocks ?? []).length === 0 &&
    flags.length === 0 && !internal.notes && (internal.observations ?? []).length === 0

  return (
    <div className="space-y-5">
      <PrivateBanner level="INTERNAL" />

      {empty && (
        <Callout tone="info" title="אין מידע פנימי לפרויקט הזה">
          זה מצב תקין. פרויקט אינו חייב מידע פנימי כדי להתקיים במערכת.
        </Callout>
      )}

      {internal.boundaryNote && (
        <Callout tone="warning" title="גבול המתחם">
          {internal.boundaryNote}
        </Callout>
      )}

      {candidates.length > 0 && (
        <Section
          title="כתובות מועמדות"
          description="הכתובות שנבדקות כחלק מהמתחם. זו רשימת מועמדות ולא גבול מאושר, ולכן העמוד הציבורי מציג עיר בלבד."
        >
          <ul className="space-y-1.5">
            {inWorkbook.map((c) => (
              <li
                key={c.address}
                className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2"
              >
                <MapPin size={15} className="flex-shrink-0 text-gray-600" aria-hidden="true" />
                <span className="text-[13px] text-gray-900">{c.address}</span>
                <span className="ms-auto inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11.5px] text-gray-600">
                  <Check size={11} aria-hidden="true" />
                  מופיע בקובץ
                </span>
              </li>
            ))}
          </ul>

          {/*
            The absence, written down.
            A gap in a numbered street reads as an oversight, and the next
            person to look would "helpfully" add it. Recording that the
            workbook does not mention it turns a silent gap into a fact.
          */}
          {notInWorkbook.length > 0 && (
            <div className="mt-4">
              <h4 className="text-[13px] font-bold text-gray-900">נבדק ואינו בקובץ</h4>
              <ul className="mt-2 space-y-2">
                {notInWorkbook.map((c) => (
                  <li key={c.address} className="rounded-lg border border-[#d8cdb8] bg-[#f4f1ec] p-3">
                    <div className="flex items-center gap-2">
                      <X size={14} className="flex-shrink-0 text-[#7d6234]" aria-hidden="true" />
                      <span className="text-[13px] font-semibold text-gray-900">{c.address}</span>
                    </div>
                    {c.note && (
                      <p className="mt-1 text-[12px] leading-relaxed text-[#7d6234]">{c.note}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>
      )}

      {(internal.blocks ?? []).length > 0 && (
        <Section
          title="גוש וחלקה"
          description="רישום מקרקעין. אינו מתפרסם בשום מצב."
        >
          <ul className="space-y-2">
            {internal.blocks!.map((b, i) => (
              <li key={`${b.block}-${i}`} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-semibold text-gray-900">
                    {b.block}{b.parcel ? ` · ${b.parcel}` : ''}
                  </span>
                  {b.needsInvestigation && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#d8cdb8] bg-[#f4f1ec] px-2 py-0.5 text-[11.5px] font-semibold text-[#7d6234]">
                      <FileSearch size={11} aria-hidden="true" />
                      דורש בדיקה
                    </span>
                  )}
                </div>
                {b.note && (
                  <p className="mt-1.5 text-[12px] leading-relaxed text-gray-700">{b.note}</p>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {internal.existingConditions && Object.keys(internal.existingConditions).length > 0 && (
        <Section
          title="מצב קיים"
          description="נתוני המצב הקיים כפי שהם מופיעים במקורות. לא נבדקו מול מקור עצמאי."
        >
          <dl>
            {Object.entries(internal.existingConditions).map(([k, v]) => (
              <Row key={k} label={EXISTING_LABEL[k] ?? k}>
                <span className="font-mono" dir="ltr">{String(v)}</span>
              </Row>
            ))}
          </dl>
        </Section>
      )}

      {/* ── §16 · Data quality ─────────────────────────────────────────── */}
      {flags.length > 0 && (
        <Section
          title="בעיות איכות נתונים"
          description="בעיה חוסמת מונעת אימות של הנתונים שהיא מציינת בשמם, ורק שלהם. היא אינה מקפיאה נתוני תהליך שאין לה קשר אליהם."
        >
          <div className="space-y-2.5">
            {blocking.map((f) => (
              <div key={f.id} className="rounded-lg border border-red-300 bg-red-50 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={15} className="mt-0.5 flex-shrink-0 text-red-700" aria-hidden="true" />
                  <div className="min-w-0">
                    <div className="text-[13px] font-bold text-red-800">
                      חוסם · {f.label}
                    </div>
                    <p className="mt-0.5 text-[12.5px] leading-relaxed text-red-800">{f.detail}</p>
                    {(f.blocks ?? []).length > 0 && (
                      <p className="mt-1.5 text-[12px] text-red-800">
                        <span className="font-semibold">חוסם את: </span>
                        {f.blocks!.map((b) => b.replace('public.facts.', '')).join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {nonBlocking.map((f) => (
              <div key={f.id} className="rounded-lg border border-[#d8cdb8] bg-[#f4f1ec] p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={15} className="mt-0.5 flex-shrink-0 text-[#7d6234]" aria-hidden="true" />
                  <div className="min-w-0">
                    <div className="text-[13px] font-bold text-[#7d6234]">{f.label}</div>
                    <p className="mt-0.5 text-[12.5px] leading-relaxed text-[#7d6234]">{f.detail}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {(internal.observations ?? []).length > 0 && (
        <Section title="תצפיות מהמקור" description="מה נראה בקובץ עצמו בזמן הבדיקה.">
          <ul className="list-disc space-y-1.5 ps-5 text-[13px] leading-relaxed text-gray-700">
            {internal.observations!.map((o) => <li key={o}>{o}</li>)}
          </ul>
        </Section>
      )}

      {/* ── §15 · Sources ──────────────────────────────────────────────── */}
      {(doc.sources ?? []).length > 0 && (
        <Section
          title="מקורות"
          description="מאיפה מגיעים הנתונים. אוצר המילים הזה פנימי ואינו מופיע באתר: הציבור רואה שנתון אומת, לא לפי איזה מקור."
        >
          <div className="space-y-3">
            {doc.sources!.map((s) => (
              <div key={s.id} className="rounded-lg border border-border p-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-bold text-gray-900">{s.label}</span>
                  <span className="rounded-full border border-border px-2 py-0.5 text-[11.5px] text-gray-600">
                    {SOURCE_TYPE_LABEL[s.type]}
                  </span>
                  <span className="rounded-full border border-border px-2 py-0.5 text-[11.5px] text-gray-600">
                    {QUALITY_LABEL[s.quality]}
                  </span>
                  <span className="rounded-full border border-border px-2 py-0.5 text-[11.5px] text-gray-600">
                    {REVIEW_STATE_LABEL[s.reviewState]}
                  </span>
                </div>
                {s.reference && (
                  <p className="mt-1.5 text-[12px] text-gray-600">אסמכתא: {s.reference}</p>
                )}
                {s.note && (
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-gray-700">{s.note}</p>
                )}
                {(s.issues ?? []).length > 0 && (
                  <ul className="mt-2 list-disc space-y-1 ps-5 text-[12px] text-[#7d6234]">
                    {s.issues!.map((i) => <li key={i}>{i}</li>)}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {internal.notes && (
        <Section title="הערות פנימיות">
          <p className="whitespace-pre-line text-[13px] leading-relaxed text-gray-700">
            {internal.notes}
          </p>
        </Section>
      )}
    </div>
  )
}

const EXISTING_LABEL: Record<string, string> = {
  note: 'הערה',
  existingBuiltAreaSqm: 'שטח בנוי קיים (מ״ר)',
  averageApartmentAreaSqm: 'שטח דירה ממוצע (מ״ר)',
  existingUnitsAmbiguous: 'מספר יחידות קיימות',
}
