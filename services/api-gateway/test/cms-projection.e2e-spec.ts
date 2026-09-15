/**
 * The public boundary, tested BY SHAPE.
 *
 * ── WHY NOT "expect(json).not.toContain('USER_VERIFIED')" ──────────────────
 *
 * A string search proves that one particular secret did not appear in one
 * particular payload. It says nothing about the next field somebody adds, and
 * it passes happily on a payload that leaked a user id, an internal note or a
 * feasibility figure — none of which contain that string.
 *
 * So these tests assert the RULE rather than the sample: an unrecognised key is
 * dropped, an unverified claim does not travel, an internal subtree disappears
 * whole, and `findPrivateLeaks` walks the result independently of the function
 * that produced it. The last one matters most: projection and assertion can
 * fail separately, and a test whose oracle is the code under test proves
 * nothing.
 *
 * These are pure-function tests. No database, no Nest, no HTTP — so a failure
 * here is unambiguous about where the fault is.
 */
import {
  toPublicProjection,
  findPrivateLeaks,
  MATERIAL_CLAIM_FIELDS,
  NEVER_PUBLIC_KEYS,
} from '../src/cms/cms.projection'

describe('CMS public projection', () => {
  describe('private keys never survive', () => {
    it.each(NEVER_PUBLIC_KEYS)('drops `%s` wherever it appears', (key) => {
      const draft = {
        title: { he: 'שקיפות ואמון' },
        [key]: 'should not travel',
        nested: { deeper: { [key]: 'nor should this', keep: 'this stays' } },
        list: [{ [key]: 'nor this', kept: 'yes' }],
      }
      const out = toPublicProjection(draft) as any

      expect(out[key]).toBeUndefined()
      expect(out.nested.deeper[key]).toBeUndefined()
      expect(out.list[0][key]).toBeUndefined()
      // The surrounding content must survive: a projection that drops
      // everything would pass a leak test while destroying the website.
      expect(out.title).toEqual({ he: 'שקיפות ואמון' })
      expect(out.nested.deeper.keep).toBe('this stays')
      expect(out.list[0].kept).toBe('yes')
      expect(findPrivateLeaks(out)).toEqual([])
    })
  })

  describe('exposure', () => {
    it('drops an INTERNAL subtree whole, not field by field', () => {
      const out = toPublicProjection({
        headline: { he: 'כותרת' },
        notes: { exposure: 'INTERNAL', body: 'internal only', anything: 42 },
      }) as any
      expect(out.notes).toBeUndefined()
      expect(out.headline).toEqual({ he: 'כותרת' })
    })

    it('drops FEASIBILITY even when it is marked verified', () => {
      // The distinction from INTERNAL: an internal figure may one day be
      // verified and published, a scenario output may not, ever.
      const out = toPublicProjection({
        scenario: {
          exposure: 'FEASIBILITY',
          plannedUnits: { value: 337.18, status: 'VERIFIED', verifiedAt: '2026-01-01' },
        },
      }) as any
      expect(out.scenario).toBeUndefined()
      expect(JSON.stringify(out)).not.toContain('337.18')
    })

    it('keeps a PUBLIC subtree', () => {
      const out = toPublicProjection({
        block: { exposure: 'PUBLIC', body: { he: 'טקסט ציבורי' } },
      }) as any
      expect(out.block.body).toEqual({ he: 'טקסט ציבורי' })
    })
  })

  describe('verification gates the claim, not the prose', () => {
    it('publishes a VERIFIED fact as value plus a badge, without the verifier', () => {
      const out = toPublicProjection({
        unitCount: {
          value: 120,
          status: 'VERIFIED',
          verifiedAt: '2026-02-01',
          verifiedByName: 'OpenDoor Group',
          source: 'USER_VERIFIED',
          sourceReference: 'workbook p.4',
        },
      }) as any

      expect(out.unitCount).toEqual({ value: 120, verified: true, verifiedAt: '2026-02-01' })
      // The three things the public must never learn.
      expect(out.unitCount.verifiedByName).toBeUndefined()
      expect(out.unitCount.source).toBeUndefined()
      expect(out.unitCount.sourceReference).toBeUndefined()
      expect(findPrivateLeaks(out)).toEqual([])
    })

    it('publishes SELF_VERIFIED, because a promoter this size has one signer', () => {
      const out = toPublicProjection({
        unitCount: { value: 120, status: 'SELF_VERIFIED', verifiedAt: '2026-02-01' },
      }) as any
      expect(out.unitCount.value).toBe(120)
    })

    it.each(['UNVERIFIED', 'SECOND_REVIEW_REQUIRED'])(
      'drops a fact whose status is %s',
      (status) => {
        const out = toPublicProjection({
          headline: { he: 'כותרת' },
          unitCount: { value: 120, status },
        }) as any
        expect(out.unitCount).toBeUndefined()
        expect(out.headline).toEqual({ he: 'כותרת' })
      },
    )

    it.each(MATERIAL_CLAIM_FIELDS)(
      'drops the bare material claim `%s` when no verification row backs it',
      (field) => {
        const out = toPublicProjection({ [field]: 120, summary: { he: 'תקציר' } }) as any
        expect(out[field]).toBeUndefined()
        expect(out.summary).toEqual({ he: 'תקציר' })
      },
    )

    it('publishes a bare material claim when a verification row backs it', () => {
      const out = toPublicProjection(
        { unitCount: 120 },
        { verification: { unitCount: 'VERIFIED' } },
      ) as any
      expect(out.unitCount).toBe(120)
    })

    it('matches the verification row by its full dotted path, not by leaf name', () => {
      // A row verifying `unitCount` must not silently authorise
      // `project.unitCount` somewhere else in the tree.
      const draft = { project: { unitCount: 99 } }
      expect((toPublicProjection(draft, { verification: { unitCount: 'VERIFIED' } }) as any).project.unitCount)
        .toBeUndefined()
      expect((toPublicProjection(draft, { verification: { 'project.unitCount': 'VERIFIED' } }) as any).project.unitCount)
        .toBe(99)
    })
  })

  describe('the rebuild is an allow-list, so new fields fail safe', () => {
    it('carries ordinary prose through untouched', () => {
      const draft = {
        blocks: [
          { type: 'heading', text: { he: 'שקיפות ואמון', en: 'Transparency and trust' } },
          { type: 'paragraph', text: { he: 'פסקה' } },
        ],
      }
      expect(toPublicProjection(draft)).toEqual(draft)
    })

    it('preserves arrays as arrays and does not collapse holes into nulls', () => {
      const out = toPublicProjection({
        items: [{ keep: 1 }, { exposure: 'INTERNAL', drop: 2 }, { keep: 3 }],
      }) as any
      // The internal entry is removed, not replaced by undefined/null.
      expect(out.items).toEqual([{ keep: 1 }, { keep: 3 }])
    })

    it('never mutates the draft it was given', () => {
      const draft = { secret: { exposure: 'INTERNAL', v: 1 }, source: 'x', keep: 'y' }
      const frozen = JSON.stringify(draft)
      toPublicProjection(draft)
      expect(JSON.stringify(draft)).toBe(frozen)
    })

    it('returns an empty object rather than undefined for a fully private draft', () => {
      // Callers STORE this. A null column would be indistinguishable from
      // "never published".
      expect(toPublicProjection({ exposure: 'INTERNAL', a: 1 })).toEqual({})
    })
  })

  describe('findPrivateLeaks is an independent oracle', () => {
    it('reports the dotted path of every private key it finds', () => {
      const leaked = {
        ok: 1,
        source: 'FEASIBILITY_WORKBOOK',
        nested: { verifiedByName: 'someone' },
        list: [{ tenantId: 't1' }],
      }
      expect(findPrivateLeaks(leaked).sort()).toEqual(
        ['list.0.tenantId', 'nested.verifiedByName', 'source'].sort(),
      )
    })

    it('finds nothing in a clean payload', () => {
      expect(findPrivateLeaks({ a: 1, b: [{ c: 'text' }], d: { e: null } })).toEqual([])
    })

    it('agrees with the projection on a realistic mixed draft', () => {
      const draft = {
        title: { he: 'מתחם טשרניחובסקי שמעוני' },
        summary: { he: 'תקציר ציבורי' },
        role: { value: { he: 'מארגן' }, status: 'SELF_VERIFIED', verifiedByName: 'OpenDoor Group', source: 'USER_VERIFIED' },
        plannedUnits: 337.18,
        internal: { workbook: 'p.4', economics: 825_600_000 },
        feasibilityScenario: { exposure: 'FEASIBILITY', totalArea: 43_930.7 },
        gallery: [
          { alt: { he: 'תמונה' }, classification: 'EDITORIAL_CONTEXT', uploadedById: 'usr_1' },
        ],
      }
      const out = toPublicProjection(draft) as any

      expect(findPrivateLeaks(out)).toEqual([])
      expect(out.title).toEqual({ he: 'מתחם טשרניחובסקי שמעוני' })
      expect(out.role.value).toEqual({ he: 'מארגן' })
      expect(out.internal).toBeUndefined()
      expect(out.feasibilityScenario).toBeUndefined()
      // An unverified scenario figure, and the economics behind it, are gone.
      expect(out.plannedUnits).toBeUndefined()
      const serialised = JSON.stringify(out)
      expect(serialised).not.toContain('337.18')
      expect(serialised).not.toContain('825600000')
      expect(serialised).not.toContain('43930.7')
      expect(out.gallery[0].alt).toEqual({ he: 'תמונה' })
      expect(out.gallery[0].uploadedById).toBeUndefined()
    })
  })
})
