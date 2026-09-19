/**
 * Seed the two real projects into the CMS as DRAFTS.
 *
 * ── WHAT THIS SCRIPT WILL NOT DO ───────────────────────────────────────────
 *
 * Publish anything, and invent anything. Every value below comes from either
 * the feasibility workbook or the client's own confirmation, and the two are
 * kept in separate `sources` entries so the workbook can never be made to look
 * as though it supports a fact it does not mention.
 *
 * Where a figure is genuinely ambiguous in the source — the owner-unit count
 * reads as 95 in one place and 98 in another — it is recorded as ambiguous and
 * flagged, NOT resolved by picking one. Resolving it here would turn a
 * data-quality problem into a number somebody later quotes.
 *
 * Idempotent: re-running updates the same rows and appends a revision.
 *
 *   pnpm --filter @urban-renewal/website exec tsx \
 *     ../../services/api-gateway/scripts/seed-cms-projects.ts
 */
import { PrismaClient } from '@prisma/client'
import { projectProjection, type ProjectDocument } from '../src/cms/project-document'

const TENANT_SLUG = process.env['CMS_IMPORT_TENANT'] ?? 'opendoor-demo'
const prisma = new PrismaClient()

const USER_VERIFIED_AT = '2026-09-01'

/** OpenDoor confirming something about its OWN engagement. Not the workbook. */
const userVerified = <T>(value: T, userId: string) => ({
  value,
  verifiedValue: value,
  status: 'SELF_VERIFIED' as const,
  editedByUserId: userId,
  editedAt: `${USER_VERIFIED_AT}T00:00:00.000Z`,
  verifiedByUserId: userId,
  verifiedAt: USER_VERIFIED_AT,
  sourceId: 'src-user-verified',
})

// ══════════════════════════════════════════════════════════════════════════
//  מתחם טשרניחובסקי - שמעוני
// ══════════════════════════════════════════════════════════════════════════

function tchernichovsky(userId: string): ProjectDocument {
  return {
    public: {
      name: { he: 'מתחם טשרניחובסקי - שמעוני' },
      /*
       * A city and NO street. Ten candidate addresses, no confirmed boundary,
       * and picking one to display would settle by presentation a question the
       * sources leave open. The projection enforces this independently: a
       * street travels only behind a verified `address` fact, and there is
       * none.
       */
      location: { city: { he: 'ירושלים', en: 'Jerusalem' } },
      summary: {
        he: 'מתחם בירושלים שבו נבחרו נציגויות בעלי דירות, וכיום מתקיים תהליך לבחינת ובחירת יזם.',
      },
      description: {
        he:
          'במתחם נבחרו נציגויות בעלי דירות, וכיום מתקיים תהליך לבחינת ובחירת היזם המתאים לקידום הפרויקט.\n\n' +
          'מידע נוסף על המתחם יתפרסם בעמוד זה לאחר שייבדק ויאומת.',
      },
      // USER-VERIFIED FACT 1 of 3.
      role: {
        he: 'OpenDoor Group מארגנת ומלווה את בעלי הדירות במתחם טשרניחובסקי - שמעוני.',
      },
      // USER-VERIFIED FACT 3 of 3. DEVELOPER_TENDER, not DEVELOPER_SELECTED:
      // a developer is being examined and chosen, and none has been selected.
      // The two stages are one apart in the enum and a world apart in meaning.
      // The public phase (גיבוש ובחירה) is DERIVED from this by the consumer.
      currentStage: userVerified('DEVELOPER_TENDER', userId),
      facts: {
        /*
         * Workbook figures enter as UNVERIFIED facts, deliberately.
         *
         * They exist so the verification tab has something real to work on and
         * so the blocking flags have something to block. None of them travels
         * until somebody signs, and several of them cannot be signed at all
         * while their flags stand.
         */
        lotArea: {
          value: 10_575, status: 'UNVERIFIED',
          sourceId: 'src-workbook', sourceReference: 'שטח מגרש רשום',
          blockedBy: ['dq-external-ref', 'dq-cached-values'],
        },
        builtArea: {
          value: 9_296.8, status: 'UNVERIFIED',
          sourceId: 'src-workbook', sourceReference: 'שטח בנוי קיים מחושב',
          blockedBy: ['dq-ref-errors', 'dq-cached-values'],
        },
        existingUnits: {
          value: null, status: 'UNVERIFIED',
          sourceId: 'src-workbook', sourceReference: '95 מול 98',
          blockedBy: ['dq-95-vs-98'],
        },
      },
    },

    // ══════════════════════════════════════════════════════════════════════
    //  INTERNAL. Never published, at any verification level.
    // ══════════════════════════════════════════════════════════════════════
    internal: {
      boundaryNote:
        'גבול המתחם אינו סופי. עשר כתובות מופיעות בקובץ ההיתכנות ואיש לא אישר אותן כגבול. ' +
        'כל עוד המצב הזה עומד, העמוד הציבורי מציג עיר בלבד וללא רחוב.',
      candidateAddresses: [
        { address: 'טשרניחובסקי 38', inWorkbook: true },
        { address: 'טשרניחובסקי 40', inWorkbook: true },
        { address: 'טשרניחובסקי 44', inWorkbook: true },
        { address: 'טשרניחובסקי 46', inWorkbook: true },
        { address: 'טשרניחובסקי 46א', inWorkbook: true },
        { address: 'שמעוני 15', inWorkbook: true },
        { address: 'שמעוני 13', inWorkbook: true },
        { address: 'שמעוני 11', inWorkbook: true },
        { address: 'שמעוני 9', inWorkbook: true },
        { address: 'שמעוני 7', inWorkbook: true },
        {
          address: 'טשרניחובסקי 42',
          inWorkbook: false,
          /*
           * Recorded EXPLICITLY as absent rather than left out.
           *
           * A gap in a numbered street reads as an oversight, and the next
           * person to look would "helpfully" add it. Writing down that the
           * workbook does not mention it turns a silent gap into a recorded
           * fact, and makes clear that its absence has not been explained
           * either. Do not infer that it belongs to the complex.
           */
          note: 'אינו מופיע בקובץ ההיתכנות. אין להסיק שהוא שייך למתחם. הסיבה להיעדרו לא נבדקה.',
        },
      ],
      blocks: [
        {
          block: 'גוש 30185',
          parcel: 'חלקה 126',
          needsInvestigation: true,
          note:
            'הכתובת של החלקה אינה ידועה, ולכן לא ניתן לקשור אותה לאף אחת מהכתובות המועמדות. ' +
            'דורש בדיקה מול הטאבו או מול העירייה לפני שימוש כלשהו.',
        },
      ],
      existingConditions: {
        note: 'נתוני המצב הקיים מגיעים מקובץ ההיתכנות ולא נבדקו מול מקור עצמאי.',
        existingBuiltAreaSqm: 9_296.8,
        averageApartmentAreaSqm: 94.87,
        existingUnitsAmbiguous: '95 או 98, תלוי בפרשנות הגיליון',
      },
      observations: [
        'שם הפרויקט מאוית באופן לא עקבי בין גיליונות הקובץ.',
        'הקובץ מפנה לקובץ חיצוני שאינו זמין, ולכן חלק מהערכים אינם ניתנים לאימות מתוך הקובץ עצמו.',
        'קיימות נוסחאות עם #REF!, כלומר הפניות שבורות.',
        'הערכים המוצגים הם ערכים שמורים. הקובץ לא חושב מחדש, ולכן ייתכן שהמספרים אינם תואמים לנוסחאות.',
      ],
      notes:
        'שני מקורות נפרדים: קובץ ההיתכנות, ואישור הלקוח. הם אינם תומכים זה בזה. ' +
        'שלוש העובדות המאומתות בעמוד הציבורי נסמכות על אישור הלקוח בלבד.',

      // ── §16 · The eight flags ────────────────────────────────────────────
      dataQualityFlags: [
        {
          id: 'dq-name-spelling', severity: 'WARNING',
          label: 'איות לא עקבי של שם הפרויקט',
          detail: 'שם המתחם מאוית באופן שונה בין גיליונות. אין לכך השפעה על מספרים, אך זה מקשה על התאמה בין מקורות.',
        },
        {
          id: 'dq-95-vs-98', severity: 'BLOCKING',
          label: 'מספר יחידות קיימות: 95 מול 98',
          detail: 'הקובץ מאפשר שתי פרשנויות למספר היחידות הקיימות. ההפרש משנה כל חישוב שנגזר ממנו.',
          blocks: ['public.facts.existingUnits'],
        },
        {
          id: 'dq-shimoni-14-13', severity: 'BLOCKING',
          label: 'סתירה בכתובת: שמעוני 14 מול שמעוני 13',
          detail: 'שתי כתובות שונות מופיעות עבור אותו מבנה. גבול המתחם אינו ניתן לקביעה כל עוד הסתירה לא נפתרה.',
          blocks: ['public.facts.address'],
        },
        {
          id: 'dq-parcel-address-unknown', severity: 'BLOCKING',
          label: 'כתובת לא ידועה: גוש 30185 חלקה 126',
          detail: 'לא ניתן לקשור את החלקה לכתובת. עד שייבדק, אי אפשר לומר אם היא בתוך המתחם.',
          blocks: ['public.facts.address', 'public.facts.lotArea'],
        },
        {
          id: 'dq-external-ref', severity: 'BLOCKING',
          label: 'הפניה לקובץ חיצוני',
          detail: 'הקובץ נשען על קובץ חיצוני שאינו זמין. ערכים שנגזרים ממנו אינם ניתנים לאימות מתוך הקובץ.',
          blocks: ['public.facts.lotArea'],
        },
        {
          id: 'dq-ref-errors', severity: 'BLOCKING',
          label: 'נוסחאות #REF!',
          detail: 'קיימות נוסחאות עם הפניות שבורות. כל ערך שתלוי בהן אינו אמין.',
          blocks: ['public.facts.builtArea'],
        },
        {
          id: 'dq-cached-values', severity: 'BLOCKING',
          label: 'סיכון בערכים שמורים',
          detail: 'הערכים בקובץ הם ערכים שמורים שלא חושבו מחדש. ייתכן שהם אינם תואמים לנוסחאות שמאחוריהם.',
          blocks: ['public.facts.lotArea', 'public.facts.builtArea'],
        },
        {
          id: 'dq-unknown-author', severity: 'WARNING',
          label: 'מחבר ותאריך הקובץ אינם ידועים',
          detail: 'לא ידוע מי הכין את הקובץ ומתי. אין למי לפנות בשאלה, ולא ידוע מול איזה מצב תכנוני הוא נכתב.',
        },
      ],
    },

    // ══════════════════════════════════════════════════════════════════════
    //  FEASIBILITY. Private forever. A scenario is not a fact about the world.
    // ══════════════════════════════════════════════════════════════════════
    feasibility: {
      // §11 · what the workbook was GIVEN
      sourceData: {
        registeredLotArea: { value: 10_575, unit: 'מ״ר', note: 'שטח מגרש רשום', reviewState: 'IN_REVIEW' },
        gisMeasuredArea: { value: 10_545.14, unit: 'מ״ר', note: 'מדידת GIS. שונה מהשטח הרשום ב-29.86 מ״ר', reviewState: 'IN_REVIEW' },
        existingBuiltArea: { value: 9_296.8, unit: 'מ״ר', note: 'שטח בנוי קיים מחושב', reviewState: 'UNREVIEWED' },
        permittedArea: { value: 12_550.68, unit: 'מ״ר', note: 'שטח מותר', reviewState: 'UNREVIEWED' },
        averageApartmentArea: { value: 94.87, unit: 'מ״ר', note: 'שטח דירה ממוצע', reviewState: 'UNREVIEWED' },
        existingUnits: { value: '95 או 98', note: 'שתי פרשנויות אפשריות. לא הוכרע.', reviewState: 'IN_REVIEW' },
      },
      // §12 · SCENARIO ASSUMPTIONS. Not planning approvals.
      assumptions: {
        note: { value: 'הנחות תרחיש בלבד. אינן אישור תכנוני, אינן תב״ע ואינן התחייבות.' },
        expropriation: { value: 'הופחתה הפרשה להפקעה', note: 'הנחת תרחיש' },
        ownerConsideration: { value: 'כלל תמורה לבעלים לפי התרחיש', note: 'אינו הסכם ואינו הצעה' },
      },
      // §13 · CALCULATED OUTPUTS. Exact precision, never rounded.
      outputs: {
        buildingEnvelope: { value: 43_930.7, unit: 'מ״ר', note: 'מעטפת בנייה בתרחיש' },
        residentialSaleArea: { value: 35_031.5, unit: 'מ״ר', note: 'שטח מכירה למגורים' },
        totalScenarioUnits: { value: 337.18, unit: 'יח״ד', note: 'פלט חישוב. אינו מספר דירות מתוכנן.' },
        developerUnits: { value: 239.18, unit: 'יח״ד', note: 'פלט חישוב' },
      },
      // §14 · ECONOMICS. The most private area in the product.
      economics: {
        sales: { value: 825_600_000, unit: '₪', note: 'מכירות בתרחיש' },
        profit: { value: 135_900_000, unit: '₪', note: 'רווח בתרחיש' },
      },
    },

    // ── §9 · Timeline. Two milestones, no dates. ─────────────────────────
    milestones: [
      {
        id: 'ts-representation', order: 1, state: 'completed',
        title: { he: 'נבחרו נציגויות בעלי הדירות', en: 'Owner representations were chosen' },
        // USER-VERIFIED FACT 2 of 3.
        fact: userVerified(true, userId),
        // No occurredAt and no periodLabel: the date is not verified, and a
        // milestone with no date is complete while an invented one is not.
      },
      {
        id: 'ts-developer-selection', order: 2, state: 'current',
        title: { he: 'בחינת ובחירת יזם', en: 'Examining and selecting a developer' },
        fact: userVerified(true, userId),
      },
      // NO upcoming milestone. Nothing about what follows has been verified,
      // and a future entry would be the generic OpenDoor process presented as
      // this project's plan.
    ],

    media: [],
    seo: {},

    // ── §15 · Sources. Kept apart on purpose. ────────────────────────────
    sources: [
      {
        id: 'src-workbook',
        type: 'FEASIBILITY_WORKBOOK',
        label: 'קובץ בדיקת היתכנות',
        reference: 'גיליון היתכנות למתחם',
        quality: 'LOW',
        reviewState: 'IN_REVIEW',
        issues: [
          'מפנה לקובץ חיצוני שאינו זמין',
          'נוסחאות #REF!',
          'ערכים שמורים שלא חושבו מחדש',
          'מחבר ותאריך אינם ידועים',
        ],
        note:
          'אינו תומך בשלוש העובדות המאומתות בעמוד הציבורי. הקובץ אינו מזכיר את תפקיד OpenDoor, ' +
          'את בחירת הנציגויות ואת שלב בחירת היזם.',
      },
      {
        id: 'src-user-verified',
        type: 'USER_VERIFIED',
        label: 'אישור הלקוח',
        quality: 'HIGH',
        reviewState: 'ACCEPTED',
        note:
          'תומך בעובדות תהליך והתקשרות בלבד. אינו יכול לתמוך במצב תכנוני, באישורים, בהיתרים, ' +
          'בשטחים או במספרי יחידות.',
      },
    ],
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  החיד"א 26 — the sparse project
// ══════════════════════════════════════════════════════════════════════════

/**
 * Deliberately almost empty.
 *
 * Hida exists in the editor to prove that a project does NOT need a timeline,
 * facts, a gallery, feasibility, English or complete SEO in order to exist as
 * a draft. A CMS that demands a full record before it will hold a project
 * teaches people to fill fields with plausible values, which is precisely the
 * failure this whole system is built to prevent.
 *
 * Its public content is carried over unchanged from the code fixture.
 */
function hida(userId: string): ProjectDocument {
  return {
    public: {
      name: { he: 'החיד"א 26' },
      location: {
        city: { he: 'ירושלים', en: 'Jerusalem' },
        street: { he: 'החיד"א 26' },
      },
      summary: {
        he: 'מתחם בירושלים שבו אנחנו מלווים ומארגנים את בעלי הדירות בתהליך ההתחדשות העירונית.',
      },
      description: {
        he:
          'אנחנו מרכזים את המידע עבור בעלי הדירות במתחם, מתאמים בין אנשי המקצוע שהם מינו, ומלווים את התהליך לאורך זמן. ההחלטות נשארות בידי בעלי הדירות.\n\n' +
          'מידע על המתחם יתפרסם בעמוד זה לאחר שייבדק ויאומת. עד אז מוצגים כאן זהות הפרויקט ותפקידנו בו בלבד.',
      },
      facts: {
        // The address IS the project name here, and OpenDoor confirmed it in
        // Pilot 1. Verified so `location.street` keeps publishing exactly as it
        // does today — the migration must not change public content.
        address: userVerified('החיד"א 26', userId),
      },
      // NO currentStage, no unit counts, no planning status, no developer, no
      // approvals, no permits, no dates, no milestones, no media. Every one of
      // those is a claim about a real building that nobody has verified.
    },
    internal: {
      notes: 'אין נתונים פנימיים לפרויקט זה. הוא קיים כאן כדי להראות שפרויקט דליל הוא מצב תקין.',
    },
    milestones: [],
    media: [],
    seo: {},
    sources: [
      {
        id: 'src-user-verified', type: 'USER_VERIFIED', label: 'אישור הלקוח',
        quality: 'HIGH', reviewState: 'ACCEPTED',
      },
    ],
  }
}

// ══════════════════════════════════════════════════════════════════════════

async function upsertProject(
  tenantId: string, userId: string, slug: string, doc: ProjectDocument, label: string,
) {
  const existing = await prisma.cmsContent.findFirst({
    where: { tenantId, kind: 'PROJECT', slug },
  })

  const content = existing
    ? await prisma.cmsContent.update({
        where: { id: existing.id },
        data: { draft: doc as never, updatedById: userId },
      })
    : await prisma.cmsContent.create({
        data: {
          tenantId, kind: 'PROJECT', slug,
          // DRAFT. Nothing in this script publishes.
          state: 'DRAFT', exposure: 'PUBLIC',
          draft: doc as never, createdById: userId, updatedById: userId,
        },
      })

  const last = await prisma.cmsRevision.findFirst({
    where: { contentId: content.id }, orderBy: { sequence: 'desc' }, select: { sequence: true },
  })
  const rev = await prisma.cmsRevision.create({
    data: {
      tenantId, contentId: content.id, sequence: (last?.sequence ?? 0) + 1,
      reason: 'SAVE', snapshot: doc as never, stateAtRevision: 'DRAFT',
      authorId: userId, summary: `זריעת פרויקט: ${label}`,
    },
  })
  await prisma.cmsContent.update({
    where: { id: content.id }, data: { currentRevisionId: rev.id },
  })

  // Mirror every fact into the queryable verification index.
  const facts: [string, { value: unknown; verifiedValue?: unknown; status: string;
    editedByUserId?: string; verifiedByUserId?: string; verifiedAt?: string;
    sourceId?: string; sourceReference?: string }][] = []
  if (doc.public.currentStage) facts.push(['public.currentStage', doc.public.currentStage as never])
  for (const [k, f] of Object.entries(doc.public.facts ?? {})) facts.push([`public.facts.${k}`, f as never])
  for (const m of doc.milestones ?? []) if (m.fact) facts.push([`milestones.${m.id}`, m.fact as never])

  for (const [field, f] of facts) {
    const data = {
      tenantId, contentId: content.id, field,
      value: (f.value ?? null) as never,
      verifiedValue: (f.verifiedValue ?? null) as never,
      status: f.status as never,
      editedById: f.editedByUserId ?? userId,
      verifiedById: f.verifiedByUserId ?? null,
      verifiedAt: f.verifiedAt ? new Date(f.verifiedAt) : null,
      source: f.sourceId ?? null,
      sourceReference: f.sourceReference ?? null,
    }
    await prisma.cmsVerification.upsert({
      where: { contentId_field: { contentId: content.id, field } },
      create: data as never,
      update: data as never,
    })
  }

  const projected = projectProjection(doc)
  console.log(`\n  ${label}  (${existing ? 'updated' : 'created'} ${content.id})`)
  console.log(`    state              : ${content.state}`)
  console.log(`    livePublication    : ${content.livePublicationId ?? 'none'}`)
  console.log(`    facts indexed      : ${facts.length}`)
  console.log(`    public projection  : ${Object.keys(projected).join(', ')}`)
  console.log(`    public street      : ${projected.location.street?.he ?? '(none — correct when unverified)'}`)
  return content.id
}

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: TENANT_SLUG } })
  if (!tenant) throw new Error(`No tenant "${TENANT_SLUG}"`)
  const user = await prisma.user.findFirst({
    where: { tenantId: tenant.id, role: { in: ['SUPER_ADMIN', 'COMPANY_ADMIN'] } },
    orderBy: { createdAt: 'asc' },
  })
  if (!user) throw new Error('No admin user to attribute the seed to')

  console.log(`\nSeeding CMS projects into ${tenant.slug} as ${user.email}`)

  await upsertProject(tenant.id, user.id, 'tchernichovsky-shimoni',
    tchernichovsky(user.id), 'מתחם טשרניחובסקי - שמעוני')
  await upsertProject(tenant.id, user.id, 'hida-26-jerusalem',
    hida(user.id), 'החיד"א 26')

  const published = await prisma.cmsContent.count({
    where: { tenantId: tenant.id, kind: 'PROJECT', state: 'PUBLISHED' },
  })
  console.log(`\n  published projects in this tenant: ${published}  (must be 0)\n`)
}

main()
  .catch((e) => { console.error(`\n  ${e instanceof Error ? e.message : e}\n`); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
