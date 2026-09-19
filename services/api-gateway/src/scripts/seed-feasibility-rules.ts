/**
 * The national baseline of the regulatory rules registry.
 *
 * ── WHY ONLY FIVE ROWS ─────────────────────────────────────────────────────
 *
 * Everything here is NATIONAL and has a citation that was supplied deliberately.
 * The rules that vary by city — parking standards, betterment levy on added
 * rights, building percentages — are left EMPTY on purpose. Seeding a plausible
 * national default for those would be worse than an empty registry: an appraisal
 * would silently inherit a number that is wrong for its municipality, and it
 * would look exactly like a number somebody checked.
 *
 * Those are filled in per city, by hand, by whoever can cite the plan.
 *
 * ── IDEMPOTENT ─────────────────────────────────────────────────────────────
 *
 * Keyed on (tenant, code, jurisdiction, effectiveFrom). Re-running it reports
 * what already exists and writes nothing, so it is safe in a deploy pipeline and
 * safe to run again after adding a tenant. It never UPDATES an existing row:
 * a rule that has been edited by a person — or cited by a signed report — must
 * not be silently rewritten by a script.
 */
import { PrismaClient, type FeasibilityRuleAuthority } from '@prisma/client'

interface SeedRule {
  code: string
  name: string
  authority: FeasibilityRuleAuthority
  numericValue: string
  unit: string
  effectiveFrom: string
  effectiveUntil: string | null
  sourceReference: string
  notes?: string
}

/**
 * NATIONAL — every row here has `jurisdiction: null`.
 *
 * Values are ratios, not percentages: 0.18, not 18. The engine's assumptions use
 * ratios, and a registry that mixed the two would produce an error a hundred
 * times the size of the input.
 */
const NATIONAL_RULES: SeedRule[] = [
  {
    code: 'vat-rate',
    name: 'שיעור מע״מ',
    authority: 'STATUTE',
    numericValue: '0.17',
    unit: 'ratio',
    effectiveFrom: '2015-01-01',
    effectiveUntil: '2025-01-01',
    sourceReference: 'חוק מע"מ, תיקון 2025',
    // The citation supplied is the amendment that ENDED this rate, not the one
    // that set it. Recorded as given rather than guessed at, and flagged here so
    // whoever refines it knows it was noticed rather than overlooked.
    notes: 'הציטוט מפנה לתיקון שסיים את השיעור הזה, לא לזה שקבע אותו — לאימות',
  },
  {
    code: 'vat-rate',
    name: 'שיעור מע״מ',
    authority: 'STATUTE',
    numericValue: '0.18',
    unit: 'ratio',
    effectiveFrom: '2025-01-01',
    effectiveUntil: null,
    sourceReference: 'חוק מע"מ, תיקון 2025',
  },
  {
    code: 'betterment-levy-rate-pinuy-binuy',
    name: 'היטל השבחה — פינוי־בינוי',
    authority: 'STATUTE',
    numericValue: '0',
    unit: 'ratio',
    effectiveFrom: '2006-01-01',
    effectiveUntil: null,
    sourceReference: 'חוק פינוי-בינוי (עידוד מיזמים), התשס"ו-2006, סעיף 23',
  },
  {
    code: 'minimum-developer-profit-tama38',
    name: 'רווח יזמי מינימלי — תמ״א 38',
    authority: 'REGULATION',
    numericValue: '0.20',
    unit: 'ratio',
    effectiveFrom: '2010-01-01',
    effectiveUntil: null,
    sourceReference: 'הנחיות שמאי ממשלתי, תמ"א 38, 2010',
  },
  {
    code: 'minimum-developer-profit-pinuy-binuy',
    name: 'רווח יזמי מינימלי — פינוי־בינוי',
    authority: 'MARKET_CONVENTION',
    numericValue: '0.25',
    unit: 'ratio',
    effectiveFrom: '2006-01-01',
    effectiveUntil: null,
    sourceReference: 'נוהג שוק מקובל, ועדת גדיש 2006',
  },
]

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

async function main() {
  const prisma = new PrismaClient()
  const onlyTenant = process.argv[2] ?? null

  try {
    const tenants = await prisma.tenant.findMany({
      where: onlyTenant ? { OR: [{ id: onlyTenant }, { slug: onlyTenant }] } : {},
      select: { id: true, name: true, slug: true },
    })

    if (tenants.length === 0) {
      console.error(onlyTenant ? `No tenant matching "${onlyTenant}".` : 'No tenants — nothing to seed.')
      process.exitCode = 1
      return
    }

    // The rules are reference data, not somebody's edit. Attributing them to a
    // real user would put that person's name on a row they never typed; the
    // audit trail for these is this script and its commit.
    const SYSTEM = 'system:seed-feasibility-rules'

    for (const tenant of tenants) {
      console.log(`\n${tenant.name} (${tenant.slug})`)

      for (const rule of NATIONAL_RULES) {
        const effectiveFrom = day(rule.effectiveFrom)
        const existing = await prisma.feasibilityRule.findFirst({
          where: { tenantId: tenant.id, code: rule.code, jurisdiction: null, effectiveFrom },
          select: { id: true, numericValue: true },
        })

        if (existing) {
          console.log(`  = ${rule.code} from ${rule.effectiveFrom} — already present (${existing.numericValue}), left alone`)
          continue
        }

        await prisma.feasibilityRule.create({
          data: {
            tenantId: tenant.id,
            code: rule.code,
            name: rule.name,
            authority: rule.authority,
            jurisdiction: null,
            numericValue: rule.numericValue,
            unit: rule.unit,
            effectiveFrom,
            effectiveUntil: rule.effectiveUntil ? day(rule.effectiveUntil) : null,
            sourceReference: rule.sourceReference,
            notes: rule.notes ?? null,
            isActive: true,
            createdById: SYSTEM,
            updatedById: SYSTEM,
          },
        })
        const until = rule.effectiveUntil ?? 'open'
        console.log(`  + ${rule.code} = ${rule.numericValue} [${rule.effectiveFrom} → ${until}]`)
      }
    }

    console.log('\nLeft empty on purpose — these vary by city and must be entered with a citation:')
    console.log('  parking standards, betterment levy on added rights, building percentages')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
