import { Fragment } from 'react'
import { BrandMark } from '@/components/brand/brand-mark'
import { ASSEMBLY_NOTICE, type AssemblyNotice } from '@urban-renewal/api-contracts'
import { Blank, DOCUMENT_FRAME, INHERIT, Runs } from './document-text'

/**
 * The notice of an owners' assembly as a blank form: the owner's own wording
 * (packages/api-contracts, assembly-notice.ts), to read on screen and to
 * print or save as a PDF.
 *
 * Laid out like the Word file: "בס"ד" and the logo, the title, the four
 * details with lines to fill in, the letter, the agenda numbered 1 to 7, and
 * the company's sign-off with its contact lines as bullets. The notice is
 * Hebrew only, so it stays right-to-left on the English site too.
 */
export function AssemblyNoticeDocument({ notice = ASSEMBLY_NOTICE }: { notice?: AssemblyNotice } = {}) {
  return (
    <article lang="he" dir="rtl" aria-labelledby="notice-title" className={DOCUMENT_FRAME}>
      <div className="mb-8 flex items-start justify-between gap-6 print:mb-5">
        <span className="text-[0.9em]">{notice.header}</span>
        <BrandMark name="OpenDoor התחדשות עירונית" variant="document" />
      </div>

      <h1 id="notice-title" className={`${INHERIT} text-center text-[1.3em] font-bold leading-snug`}>
        {notice.title}
      </h1>

      <dl className="mt-8 grid grid-cols-[auto_minmax(0,1fr)] items-end gap-x-4 gap-y-3 print:mt-6 print:gap-y-2">
        {notice.fields.map((field) => (
          <Fragment key={field.key}>
            <dt className="font-bold">{field.label}:</dt>
            <dd>
              {field.key === 'meetingDate' ? (
                <span dir="ltr" className="inline-flex items-end gap-1">
                  <Blank size="sm" />/<Blank size="sm" />/<Blank size="md" />
                </span>
              ) : (
                <Blank size={field.key === 'meetingTime' ? 'sm' : 'lg'} />
              )}
            </dd>
          </Fragment>
        ))}
      </dl>

      <p className={`${INHERIT} mt-8 font-bold print:mt-6`}>{notice.addresseeLabel}</p>
      <p className={INHERIT}>{notice.addressee}</p>
      <p className={`${INHERIT} mt-4`}>{notice.greeting}</p>
      {notice.intro.map((text, index) => (
        <p key={index} className={`${INHERIT} mt-4`}>
          <Runs text={text} />
        </p>
      ))}

      <h2 className={`${INHERIT} mt-6 font-bold print:break-after-avoid`}>{notice.agendaHeading}</h2>
      <ol className="mt-2 space-y-2 print:space-y-1.5">
        {notice.agenda.map((item, index) => (
          <li key={item.lead} className="grid grid-cols-[1.75rem_minmax(0,1fr)] print:break-inside-avoid">
            <span>{index + 1}.</span>
            <span>
              <strong className="font-bold">{item.lead}</strong> {item.text}
            </span>
          </li>
        ))}
      </ol>

      <h2 className={`${INHERIT} mt-6 font-bold print:break-after-avoid`}>{notice.importanceHeading}</h2>
      <p className={INHERIT}>{notice.importance}</p>
      <p className={`${INHERIT} mt-4`}>{notice.closing}</p>

      <div className="mt-8 print:mt-6 print:break-inside-avoid">
        <p className={`${INHERIT} font-bold`}>{notice.signOff}</p>
        <p className={`${INHERIT} font-bold`}>{notice.company}</p>
        <ul className="mt-2 list-disc space-y-0.5 ps-5">
          {notice.contacts.map((contact) => (
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
