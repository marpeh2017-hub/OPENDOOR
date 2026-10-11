import { Fragment } from 'react'
import type { AssemblyNotice } from '@urban-renewal/api-contracts'
import { Blank, DOCUMENT_FRAME, DocumentHeader, INHERIT, Runs, documentDate } from './document-parts'

/**
 * The notice of an owners' assembly as a document: the snapshot it was sent
 * with and this assembly's details (the address line, the date, the hour,
 * the place), laid out like the owner's Word file. Blank as the template, a
 * preview while staff fill it in, and the notice as owners got it.
 */
export function NoticeView({
  text,
  fields,
  meetingDate,
  meetingPlace,
  titleLevel = 1,
}: {
  text: AssemblyNotice
  fields?: Record<string, string> | null
  meetingDate?: string
  meetingPlace?: string
  titleLevel?: 1 | 2
}) {
  const Title = titleLevel === 1 ? 'h1' : 'h2'
  const value = (key: string): string => {
    if (key === 'meetingDate') return documentDate(meetingDate).replace(/\./g, '/')
    if (key === 'meetingPlace') return meetingPlace ?? ''
    return fields?.[key] ?? ''
  }

  return (
    <article lang="he" dir="rtl" aria-labelledby="notice-title" className={DOCUMENT_FRAME}>
      <DocumentHeader header={text.header} />

      <Title id="notice-title" className="text-center text-[1.2em] font-bold leading-snug tracking-normal text-inherit">
        {text.title}
      </Title>

      <dl className="mt-8 grid grid-cols-[auto_minmax(0,1fr)] items-end gap-x-4 gap-y-3 print:mt-6 print:gap-y-2">
        {text.fields.map((field) => (
          <Fragment key={field.key}>
            <dt className="font-bold">{field.label}:</dt>
            <dd>{value(field.key) ? <span className="font-medium">{value(field.key)}</span> : <Blank />}</dd>
          </Fragment>
        ))}
      </dl>

      <p className={`${INHERIT} mt-8 font-bold print:mt-6`}>{text.addresseeLabel}</p>
      <p className={INHERIT}>{text.addressee}</p>
      <p className={`${INHERIT} mt-4`}>{text.greeting}</p>
      {text.intro.map((paragraph, index) => (
        <p key={index} className="mt-4">
          <Runs text={paragraph} />
        </p>
      ))}

      <h2 className={`${INHERIT} mt-6 text-[1em] font-bold print:break-after-avoid`}>{text.agendaHeading}</h2>
      <ol className="mt-2 space-y-2 print:space-y-1.5">
        {text.agenda.map((item, index) => (
          <li key={item.lead} className="grid grid-cols-[1.75rem_minmax(0,1fr)] print:break-inside-avoid">
            <span>{index + 1}.</span>
            <span>
              <strong className="font-bold">{item.lead}</strong> {item.text}
            </span>
          </li>
        ))}
      </ol>

      <h2 className={`${INHERIT} mt-6 text-[1em] font-bold print:break-after-avoid`}>{text.importanceHeading}</h2>
      <p className={INHERIT}>{text.importance}</p>
      <p className={`${INHERIT} mt-4`}>{text.closing}</p>

      <div className="mt-8 print:mt-6 print:break-inside-avoid">
        <p className={`${INHERIT} font-bold`}>{text.signOff}</p>
        <p className={`${INHERIT} font-bold`}>{text.company}</p>
        <ul className="mt-2 list-disc space-y-0.5 ps-5">
          {text.contacts.map((contact) => (
            <li key={contact.label}>
              <strong className="font-bold">{contact.label}:</strong>{' '}
              <span dir={/[\d@]/.test(contact.value) ? 'ltr' : undefined}>{contact.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  )
}
