/**
 * The project public boundary, tested by SHAPE.
 *
 * ── WHY THESE TESTS LOOK DIFFERENT FROM THE PAGE ONES ──────────────────────
 *
 * `cms-projection.e2e-spec.ts` tests a deny-list rebuild: it proves that
 * unrecognised keys are dropped. This suite tests an ALLOWLIST, so the
 * strongest assertion available is different and better: take a document with
 * private data in every private slot, project it, and assert the result's KEY
 * SET is a subset of the fields the projection is allowed to emit.
 *
 * That single assertion covers every field nobody has invented yet. A new key
 * under `internal` does not need a new test, because the test does not
 * enumerate what must be absent — it enumerates what may be present.
 */
import {
  projectProjection,
  projectPublicationCheck,
  type ProjectDocument,
} from '../src/cms/project-document'

/** Every key the public projection is permitted to emit, at the top level. */
const ALLOWED_TOP_LEVEL = new Set([
  'name', 'location', 'summary', 'description', 'role',
  'currentStage', 'facts', 'cta', 'milestones', 'media', 'seo',
])

const verified = <T>(value: T) => ({
  value, verifiedValue: value, status: 'SELF_VERIFIED' as const,
  verifiedAt: '2026-09-01', verifiedByUserId: 'usr_admin_01',
  editedByUserId: 'usr_admin_01', sourceId: 'src-user',
  sourceReference: 'confirmed by the client',
})

/** A document with something private in every private slot. */
const FULL: ProjectDocument = {
  public: {
    name: { he: 'מתחם טשרניחובסקי - שמעוני' },
    location: { city: { he: 'ירושלים', en: 'Jerusalem' }, street: { he: 'טשרניחובסקי 42' } },
    summary: { he: 'תקציר ציבורי' },
    description: { he: 'תיאור ציבורי' },
    role: { he: 'OpenDoor Group מארגנת ומלווה את בעלי הדירות.' },
    currentStage: verified('DEVELOPER_TENDER'),
    facts: {
      // Deliberately NOT verified: the address is the whole open question.
      address: { value: 'טשרניחובסקי 42', status: 'UNVERIFIED' },
      lotArea: { value: 10_575, status: 'UNVERIFIED', sourceId: 'src-workbook' },
      unitCount: verified(120),
    },
  },
  internal: {
    candidateAddresses: [
      { address: 'טשרניחובסקי 38', inWorkbook: true },
      { address: 'טשרניחובסקי 42', inWorkbook: false, note: 'אינו מופיע בקובץ' },
    ],
    boundaryNote: 'גבול המתחם אינו סופי',
    blocks: [{ block: 'גוש 30185', parcel: 'חלקה 126', needsInvestigation: true }],
    existingConditions: { builtArea: 9_296.8 },
    observations: ['תצפית פנימית'],
    notes: 'הערות פנימיות',
    dataQualityFlags: [
      { id: 'f1', label: 'סתירה בכתובת', detail: 'שמעוני 14 מול שמעוני 13',
        severity: 'BLOCKING', blocks: ['public.facts.unitCount'] },
    ],
  },
  feasibility: {
    sourceData: { registeredLotArea: { value: 10_575, unit: 'מ״ר' } },
    assumptions: { averageFloors: { value: 8 } },
    outputs: { plannedUnits: { value: 337.18 }, saleableArea: { value: 35_031.5 } },
    economics: { sales: { value: 825_600_000 }, profit: { value: 135_900_000 } },
  },
  milestones: [
    { id: 'm1', title: { he: 'נבחרו נציגויות' }, state: 'completed', order: 1, fact: verified(true) },
    { id: 'm2', title: { he: 'בחינת ובחירת יזם' }, state: 'current', order: 2, fact: verified(true) },
    { id: 'm3', title: { he: 'טרם אומת' }, state: 'upcoming', order: 3,
      fact: { value: true, status: 'UNVERIFIED' } },
  ],
  media: [
    { id: 'img1', storageKey: 'tnt_01/p/1.jpg', filename: '1.jpg', classification: 'EDITORIAL_CONTEXT',
      alt: { he: 'תצלום הקשר' }, order: 1 },
    { id: 'img2', storageKey: 'tnt_01/p/2.jpg', filename: '2.jpg', classification: 'VERIFIED_PROJECT_PHOTO',
      alt: { he: '' }, order: 2 },
  ],
  seo: { he: { title: 'כותרת', description: 'תיאור' } },
  sources: [
    { id: 'src-workbook', type: 'FEASIBILITY_WORKBOOK', label: 'קובץ היתכנות',
      reference: 'גיליון 1', quality: 'LOW', reviewState: 'IN_REVIEW', issues: ['#REF!'] },
    { id: 'src-user', type: 'USER_VERIFIED', label: 'אישור הלקוח',
      quality: 'HIGH', reviewState: 'ACCEPTED' },
  ],
}

/** Collect every key present anywhere in a structure. */
function allKeys(node: unknown, into = new Set<string>()): Set<string> {
  if (node === null || typeof node !== 'object') return into
  if (Array.isArray(node)) { node.forEach((v) => allKeys(v, into)); return into }
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    into.add(k)
    allKeys(v, into)
  }
  return into
}

describe('project public projection', () => {
  const out = projectProjection(FULL)
  const serialised = JSON.stringify(out)

  describe('the allowlist holds structurally', () => {
    it('emits only permitted top-level keys', () => {
      for (const k of Object.keys(out)) expect(ALLOWED_TOP_LEVEL.has(k)).toBe(true)
    })

    it('carries no key named after a private area, at any depth', () => {
      const keys = allKeys(out)
      for (const forbidden of [
        'internal', 'feasibility', 'sources', 'economics', 'assumptions', 'outputs',
        'sourceData', 'candidateAddresses', 'boundaryNote', 'blocks', 'parcel',
        'existingConditions', 'observations', 'dataQualityFlags', 'notes',
        'verifiedByUserId', 'editedByUserId', 'sourceId', 'sourceReference',
        'verifiedValue', 'status', 'blockedBy',
      ]) {
        expect(keys.has(forbidden)).toBe(false)
      }
    })

    it('is unchanged when a brand-new private field is added', () => {
      // The point of an allowlist: a field nobody has thought of yet cannot
      // leak, and needs no new test to prove it.
      const withNewField = {
        ...FULL,
        internal: { ...FULL.internal, someFieldInventedTomorrow: 'secret' },
        feasibility: { ...FULL.feasibility, newEconomicModel: { irr: 0.23 } },
      } as unknown as ProjectDocument
      expect(JSON.stringify(projectProjection(withNewField))).toBe(serialised)
    })
  })

  describe('nothing private survives, by value', () => {
    it.each([
      ['337.18', 'planned units'],
      ['35031.5', 'saleable area'],
      ['825600000', 'sales'],
      ['135900000', 'profit'],
      ['9296.8', 'existing built area'],
      ['10575', 'lot area'],
      ['גוש 30185', 'block'],
      ['חלקה 126', 'parcel'],
      ['טשרניחובסקי 38', 'a candidate address'],
      ['FEASIBILITY_WORKBOOK', 'source vocabulary'],
      ['USER_VERIFIED', 'source vocabulary'],
      ['usr_admin_01', 'verifier identity'],
      ['הערות פנימיות', 'internal notes'],
      ['סתירה בכתובת', 'a data-quality flag'],
    ])('does not contain %s (%s)', (needle) => {
      expect(serialised).not.toContain(needle)
    })
  })

  describe('verification gates each claim independently', () => {
    it('publishes a verified fact as value plus badge, without the verifier', () => {
      expect(out.facts?.['unitCount']).toEqual({
        value: 120, verified: true, verifiedAt: '2026-09-01',
      })
    })

    it('drops an unverified fact', () => {
      expect(out.facts?.['lotArea']).toBeUndefined()
    })

    it('publishes the stage but never the phase, which the consumer derives', () => {
      expect(out.currentStage).toEqual({
        value: 'DEVELOPER_TENDER', verified: true, verifiedAt: '2026-09-01',
      })
      expect((out as unknown as Record<string, unknown>)['phase']).toBeUndefined()
    })

    it('drops a verified fact whose value has since been edited', () => {
      const edited: ProjectDocument = {
        ...FULL,
        public: {
          ...FULL.public,
          facts: { unitCount: { ...verified(120), value: 130 } },
        },
      }
      // Signed for 120, now says 130. Nobody stands behind 130.
      expect(projectProjection(edited).facts?.['unitCount']).toBeUndefined()
    })
  })

  describe('the street is gated on a verified address', () => {
    it('publishes a city and no street when the address is unverified', () => {
      expect(out.location.city).toEqual({ he: 'ירושלים', en: 'Jerusalem' })
      expect(out.location.street).toBeUndefined()
      expect(serialised).not.toContain('טשרניחובסקי 42')
    })

    it('publishes the street once the address fact is verified', () => {
      const withAddress: ProjectDocument = {
        ...FULL,
        public: {
          ...FULL.public,
          facts: { ...FULL.public.facts, address: verified('טשרניחובסקי 42') },
        },
      }
      expect(projectProjection(withAddress).location.street).toEqual({ he: 'טשרניחובסקי 42' })
    })

    it('never publishes `address` as a bare fact of its own', () => {
      const withAddress: ProjectDocument = {
        ...FULL,
        public: { ...FULL.public, facts: { address: verified('טשרניחובסקי 42') } },
      }
      expect(projectProjection(withAddress).facts?.['address']).toBeUndefined()
    })
  })

  describe('milestones and media', () => {
    it('keeps verified milestones and drops the unverified one', () => {
      expect(out.milestones?.map((m) => m.id)).toEqual(['m1', 'm2'])
    })

    it('invents no dates', () => {
      for (const m of out.milestones ?? []) {
        expect(m.occurredAt).toBeUndefined()
        expect(m.periodLabel).toBeUndefined()
      }
    })

    it('drops an image with no Hebrew alt text', () => {
      expect(out.media?.map((m) => m.id)).toEqual(['img1'])
    })

    it('CARRIES the image classification, so the site can label it honestly', () => {
      // Dropping this would let an editorial photograph render with the same
      // caption as a project photograph, which is the exact claim the
      // classification exists to prevent.
      expect(out.media?.[0]?.classification).toBe('EDITORIAL_CONTEXT')
    })
  })

  describe('SEO is built only from public content', () => {
    it('emits what the editor set', () => {
      expect(out.seo).toEqual({ he: { title: 'כותרת', description: 'תיאור' } })
    })

    it('cannot be built from internal or feasibility data', () => {
      // There is no code path from those into seo — the projection never reads
      // them — so an empty seo block stays empty rather than being "helpfully"
      // filled from whatever text was nearest.
      const noSeo = { ...FULL, seo: undefined }
      expect(projectProjection(noSeo).seo).toBeUndefined()
    })
  })

  describe('an empty project projects to something renderable', () => {
    it('does not throw on a sparse draft', () => {
      const sparse = { public: { name: { he: 'החיד״א 26' }, location: { city: { he: 'ירושלים' } } } }
      const p = projectProjection(sparse as ProjectDocument)
      expect(p.name).toEqual({ he: 'החיד״א 26' })
      expect(p.milestones).toBeUndefined()
      expect(p.media).toBeUndefined()
      expect(p.facts).toBeUndefined()
    })
  })
})

describe('project publication check', () => {
  const check = projectPublicationCheck(FULL, { exposure: 'PUBLIC' })

  it('names what will become public', () => {
    const fields = check.willBecomePublic.map((w) => w.field)
    expect(fields).toContain('public.name')
    expect(fields).toContain('public.location.city')
    expect(fields).toContain('public.currentStage')
    expect(fields).toContain('milestones')
  })

  it('names what stays private, in writing', () => {
    const areas = check.staysPrivate.map((s) => s.area)
    expect(areas).toEqual(expect.arrayContaining([
      'internal.candidateAddresses', 'internal.blocks', 'internal.existingConditions',
      'feasibility', 'feasibility.economics', 'verification.audit', 'sources',
    ]))
  })

  it('warns about unverified facts rather than blocking on them', () => {
    // They do not travel anyway. Blocking would stop a correct page over a
    // field the projection was going to drop.
    const warned = check.warnings.filter((w) => w.code === 'UNVERIFIED_FACT')
    expect(warned.length).toBeGreaterThan(0)
    expect(check.blockers.map((b) => b.code)).not.toContain('UNVERIFIED_FACT')
  })

  it('blocks a verified fact that a BLOCKING data-quality flag names', () => {
    expect(check.blockers.map((b) => b.code)).toContain('BLOCKED_BY_DATA_QUALITY')
    expect(check.canPublish).toBe(false)
  })

  it('does NOT block unrelated verified process facts', () => {
    // The flag names unitCount. The stage and the milestones are OpenDoor's
    // own verified process facts and have nothing to do with a workbook
    // address discrepancy.
    const blockedFields = check.blockers.map((b) => b.field)
    expect(blockedFields).not.toContain('public.currentStage')
    expect(blockedFields).not.toContain('milestones')
  })

  it('blocks an image with no alt text', () => {
    expect(check.blockers.map((b) => b.code)).toContain('MEDIA_MISSING_ALT')
  })

  it('treats a missing English translation as a warning, never a blocker', () => {
    expect(check.warnings.map((w) => w.code)).toContain('NO_ENGLISH_SUMMARY')
    expect(check.blockers.map((b) => b.code)).not.toContain('NO_ENGLISH_SUMMARY')
  })

  it('refuses outright when the project is marked internal', () => {
    const c = projectPublicationCheck(FULL, { exposure: 'INTERNAL' })
    expect(c.canPublish).toBe(false)
    expect(c.blockers.map((b) => b.code)).toContain('NOT_PUBLIC_EXPOSURE')
  })

  it('passes for a clean project', () => {
    const clean: ProjectDocument = {
      public: {
        name: { he: 'פרויקט', en: 'Project' },
        location: { city: { he: 'ירושלים' } },
        summary: { he: 'תקציר', en: 'Summary' },
      },
      seo: { he: { title: 'כותרת' } },
    }
    const c = projectPublicationCheck(clean, { exposure: 'PUBLIC' })
    expect(c.blockers).toEqual([])
    expect(c.canPublish).toBe(true)
  })
})
