/**
 * The representation-appointment protocol: "פרוטוקול מינוי נציגות בעלי דירות
 * לקידום פרויקט פינוי-בינוי", the owner's own document, as data.
 *
 * ── THE WORDING IS THE OWNER'S ─────────────────────────────────────────────
 *
 * Copied word for word from the owner's Word file (2026-10-07), with its bold
 * and underlining. Change a word here only when the owner has approved it.
 * The changes they approved on 2026-10-07, and nothing else:
 *
 *   - 5.1: "קבלת מידע ונתונים מיזמים, מיועצים ומרשויות;" (was "מטעם החברה,
 *     יועצים ורשויות"; the protocol never defines "החברה").
 *   - 8: "החברה" removed, so the clause binds the representation alone, and
 *     the verb follows ("מתחייבת").
 *   - The agenda line: "לקידום", as in the title, not "לביצוע".
 *   - 10: a member's resignation ends that member's term only, not the
 *     representation's. THE WORDING BELOW IS A PROPOSAL AWAITING THE OWNER'S
 *     APPROVAL (2026-10-07); the original listed the resignation of any one
 *     member as ending the whole representation's term.
 *   - The preparer's ID number is not in the public text (protocolPreparedBy).
 *
 * Numbering follows the file's own settings: the two parts are lettered (א,
 * ב), the clauses run 1 to 11 across both, and sub-items are numbered under
 * their clause (5.1, 5.2). The owner has been asked to confirm this matches
 * how Word shows it.
 *
 * ── ONE TEXT, THREE READERS ────────────────────────────────────────────────
 *
 * The website prints it blank on /forms, the portal shows it before an owner
 * signs, and the CRM fills it in and assembles the signed copy. They read this
 * one constant, so a signed copy can never show different words from the ones
 * an owner read. `version` names the wording: change it whenever a word
 * changes, and a signed copy records the version it was signed on.
 *
 * ── MARKUP ─────────────────────────────────────────────────────────────────
 *
 * Text carries the document's emphasis as **bold** and __underline__, which
 * nest (__**both**__). There is no other markup, so the text reads here almost
 * as it reads in the document. `protocolRuns` turns it into runs to render,
 * `protocolPlainText` strips it.
 */

/** Text with the document's emphasis: **bold**, __underline__. */
export type ProtocolText = string

export interface ProtocolRun {
  text: string
  bold: boolean
  underline: boolean
}

/** Splits marked-up text into runs, each with its own emphasis. */
export function protocolRuns(text: ProtocolText): ProtocolRun[] {
  const runs: ProtocolRun[] = []
  let bold = false
  let underline = false
  let buffer = ''
  const flush = () => {
    if (buffer) runs.push({ text: buffer, bold, underline })
    buffer = ''
  }
  for (let i = 0; i < text.length; i++) {
    const pair = text.slice(i, i + 2)
    if (pair === '**' || pair === '__') {
      flush()
      if (pair === '**') bold = !bold
      else underline = !underline
      i++
      continue
    }
    buffer += text[i]
  }
  flush()
  return runs
}

/** The words alone, for search, comparison and a document hash. */
export function protocolPlainText(text: ProtocolText): string {
  return text.replace(/\*\*|__/g, '')
}

/** One of the four details filled in for each meeting. */
export interface ProtocolMeetingField {
  key: 'compoundName' | 'address' | 'meetingDate' | 'meetingPlace'
  label: string
  /** What follows the filled-in value, as the document prints it. */
  after: ProtocolText
}

export type ProtocolBlock =
  | { kind: 'paragraph'; text: ProtocolText }
  /** Sub-items, numbered under their clause: 5.1, 5.2… */
  | { kind: 'items'; items: readonly ProtocolText[] }
  /** The table of representation members, filled in per meeting. */
  | { kind: 'representationTable' }

export interface ProtocolClause {
  number: number
  /** Clauses 3 to 11 open with a heading; 1 and 2 are a numbered paragraph. */
  heading?: ProtocolText
  blocks: readonly ProtocolBlock[]
}

export interface ProtocolPart {
  /** The part's letter, as the document numbers it. */
  letter: string
  title: ProtocolText
  clauses: readonly ProtocolClause[]
}

export interface ProtocolTableColumn {
  key: string
  label: ProtocolText
}

/**
 * The document's closing line. The signed copy, and only the signed copy,
 * gives the preparer's ID number after the name: the number is deliberately
 * not in this package, which ships to browsers, and the signed copy gets it
 * from the server that assembles it.
 */
export function protocolPreparedBy(idNumber?: string): string {
  const preparer = idNumber ? `מיכאל רוזנבך ${idNumber}` : 'מיכאל רוזנבך'
  return `מכין המסמך ${preparer} באמצעות חברת קבוצת אופן דור יזמות והתחדשות בע״מ, ח.פ. 515856334.`
}

export interface RepresentationProtocol {
  id: string
  version: string
  header: string
  title: string
  meeting: {
    fields: readonly ProtocolMeetingField[]
    agendaLabel: string
    agenda: ProtocolText
  }
  parts: readonly ProtocolPart[]
  representationTable: { columns: readonly ProtocolTableColumn[]; blankRows: number }
  ownersTable: { heading: ProtocolText; columns: readonly ProtocolTableColumn[]; blankRows: number }
}

export const REPRESENTATION_PROTOCOL: RepresentationProtocol = {
  id: 'representation-protocol',
  /** Names the wording. Change it whenever a word changes. */
  version: '2026-10-07',
  header: 'בס"ד',
  title: 'פרוטוקול מינוי נציגות בעלי דירות לקידום פרויקט פינוי-בינוי',

  meeting: {
    fields: [
      { key: 'compoundName', label: 'שם המתחם', after: ' (להלן: "**המתחם**");' },
      { key: 'address', label: 'כתובת', after: ';' },
      { key: 'meetingDate', label: 'תאריך', after: ';' },
      { key: 'meetingPlace', label: 'מקום הישיבה', after: ';' },
    ],
    agendaLabel: 'על סדר היום',
    agenda: '__מינוי נציגות בעלים לקידום פרויקט פינוי-בינוי__;',
  },

  parts: [
    {
      letter: 'א',
      title: '__**רקע**__',
      clauses: [
        {
          number: 1,
          blocks: [
            {
              kind: 'paragraph',
              text: 'בעלי הזכויות בדירות ובנכסים במתחם (להלן בהתאמה: "**בעלי הזכויות**" / "**הדירות**") התכנסו לצורך בחינה וקידום אפשרות לביצוע פרויקט התחדשות עירונית מסוג פינוי-בינוי במתחם.',
            },
          ],
        },
        {
          number: 2,
          blocks: [
            {
              kind: 'paragraph',
              text: 'לאחר דיון בנושא, ובהבנה כי לצורך קידום יעיל, מסודר ושקוף של התהליך נדרש גוף מייצג מטעם בעלי הדירות, הוחלט למנות נציגות בעלי דירות שתפעל בשם בעלי הזכויות לקידום שלבי הבדיקה, הארגון והתיאום של הפרויקט.',
            },
          ],
        },
      ],
    },
    {
      letter: 'ב',
      title: '__**החלטות האסיפה**__**:**',
      clauses: [
        {
          number: 3,
          heading: '__עקרון קידום הפרויקט__',
          blocks: [
            {
              kind: 'paragraph',
              text: 'בעלי הדירות במתחם מביעים את הסכמתם העקרונית לבחינת וקידום פרויקט התחדשות עירונית מסוג פינוי-בינוי במתחם, בכפוף לבדיקה תכנונית, משפטית וכלכלית, ובכפוף לאישור פרטני של כל בעל דירה ביחס להסכם הסופי שייחתם בעתיד, ככל שייחתם.',
            },
          ],
        },
        {
          number: 4,
          heading: '__מינוי נציגות בעלי הדירות__',
          blocks: [
            {
              kind: 'paragraph',
              text: 'בעלי הדירות ממנים בזאת את חברי הנציגות הבאים כנציגות מטעמם לצורך קידום שלבי הארגון והבדיקה של הפרויקט, כדלהלן:',
            },
            { kind: 'representationTable' },
          ],
        },
        {
          number: 5,
          heading: '__סמכויות הנציגות__',
          blocks: [
            { kind: 'paragraph', text: '__הנציגות תהיה מוסמכת לפעול בשם בעלי הדירות בנושאים הבאים:__' },
            {
              kind: 'items',
              items: [
                'קבלת מידע ונתונים מיזמים, מיועצים ומרשויות;',
                'קיום פגישות ומשא ומתן ראשוני עם יזמים ויועצים;',
                'בחינת הצעות לקידום הפרויקט;',
                'המלצה לבעלי הדירות ביחס לבחירת אנשי מקצוע ויזמים;',
                'קבלת עדכונים שוטפים והעברתם לבעלי הדירות;',
              ],
            },
            { kind: 'paragraph', text: '**החלטות הנציגות יתקבלו ברוב קולות חברי הנציגות המשתתפים בדיון.**' },
          ],
        },
        {
          number: 6,
          heading: '__**הגבלת סמכויות הנציגות**__',
          blocks: [
            { kind: 'paragraph', text: '__מובהר בזאת כי הנציגות **אינה** מוסמכת:__' },
            {
              kind: 'items',
              items: [
                'לחתום בשם בעלי הדירות על הסכם פינוי-בינוי מחייב;',
                'להתחייב בשם בעלי הדירות לכל התחייבות כספית;',
                'לוותר על זכויות של בעלי הדירות;',
                'לחייב בעל דירה כלשהו ללא הסכמתו האישית בכתב;',
              ],
            },
            {
              kind: 'paragraph',
              text: '__**התקשרות מחייבת מול יזם תיעשה אך ורק באמצעות חתימה אישית של כל בעל זכויות על הסכם פרטני.**__',
            },
          ],
        },
        {
          number: 7,
          heading: '__**בחירת יועצים ובעלי מקצוע**__',
          blocks: [
            {
              kind: 'paragraph',
              text: 'הנציגות תהיה רשאית למנות עורך דין, מפקח, שמאי ויועצים מקצועיים נוספים לצורך קידום הפרויקט, ובלבד:',
            },
            {
              kind: 'items',
              items: [
                'שהמינוי יאושר ע"י רוב חברי הנציגות;',
                'שיוצגו לבעלי הדירות תנאי ההתקשרות;',
                'שלא תחול על בעלי הדירות עלות כספית כלשהי.',
              ],
            },
          ],
        },
        {
          number: 8,
          heading: '__**חובת שקיפות ודיווח**__',
          blocks: [
            { kind: 'paragraph', text: 'הנציגות מתחייבת לפעול בשקיפות מלאה מול בעלי הדירות, לרבות:' },
            {
              kind: 'items',
              items: [
                'עדכון תקופתי ביחס להתקדמות הפרויקט;',
                'תיעוד פגישות והחלטות מהותיות;',
                'העברת מידע מהותי לבעלי הדירות בתוך זמן סביר;',
              ],
            },
          ],
        },
        {
          number: 9,
          heading: '__**ניגוד עניינים**__',
          blocks: [
            {
              kind: 'paragraph',
              text: 'חבר נציגות יפעל בנאמנות, בהגינות ובתום לב לטובת כלל בעלי הדירות במתחם. חבר נציגות אשר קיים בעניינו חשש לניגוד עניינים מהותי יודיע על כך לנציגות ולבעלי הדירות, ויימנע מלהשתתף בדיון או בקבלת ההחלטה הנוגעת לעניין זה. חברי הנציגות פועלים בהתנדבות ובתום לב במסגרת תפקידם, ולא יישאו באחריות אישית לכל נזק, הפסד או החלטה שיתקבלו במסגרת פעילות הנציגות, אלא אם פעלו בזדון, בחוסר תום לב או ברשלנות חמורה.',
            },
          ],
        },
        {
          number: 10,
          heading: '__**תקופת כהונת הנציגות**__',
          // PROPOSED WORDING, AWAITING THE OWNER'S APPROVAL (2026-10-07).
          blocks: [
            { kind: 'paragraph', text: '**כהונת הנציגות תהיה עד להחלטת רוב בעלי הדירות על החלפת הנציגות.**' },
            {
              kind: 'paragraph',
              text: 'חבר נציגות רשאי להתפטר בהודעה לנציגות ולבעלי הדירות. התפטרותו תסיים את כהונתו בלבד, ושאר חברי הנציגות ימשיכו לכהן.',
            },
          ],
        },
        {
          number: 11,
          heading: '__**שונות**__',
          blocks: [
            {
              kind: 'paragraph',
              text: 'פרוטוקול זה נועד להסדיר את פעילות הנציגות בשלבי הארגון והקידום הראשוניים בלבד, ואינו מהווה הסכם פינוי-בינוי מחייב.',
            },
          ],
        },
      ],
    },
  ],

  representationTable: {
    columns: [
      { key: 'fullName', label: '__שם מלא__' },
      { key: 'idNumber', label: '__ת.ז__' },
      { key: 'apartment', label: '__דירה__' },
      { key: 'signature', label: '__חתימה__' },
    ],
    /** Empty rows on the printed form, as in the source. */
    blankRows: 3,
  },

  ownersTable: {
    heading: '__**חתימות בעלי הדירות**__',
    columns: [
      { key: 'apartment', label: "__**מס' דירה**__" },
      { key: 'fullName', label: '__**שם מלא**__' },
      { key: 'idNumber', label: '__**ת.ז**__' },
      { key: 'date', label: '__**תאריך**__' },
      { key: 'signature', label: '__**חתימה**__' },
      { key: 'phone', label: '__**טלפון**__' },
      { key: 'email', label: '__**אימייל**__' },
    ],
    /** Empty rows on the printed form, as in the source. */
    blankRows: 20,
  },
}

/** Clauses across both parts: 11. */
export const PROTOCOL_CLAUSE_COUNT = REPRESENTATION_PROTOCOL.parts.reduce(
  (count, part) => count + part.clauses.length,
  0,
)

/** A sub-item's number, as the document prints it: 5.1, 5.2… */
export function protocolItemNumber(clause: number, index: number): string {
  return `${clause}.${index + 1}`
}
