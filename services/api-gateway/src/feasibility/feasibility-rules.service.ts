import { Injectable } from '@nestjs/common'
import { effectiveProjectType } from './project-type-inputs'
import { Prisma, type FeasibilityRule, type FeasibilityRuleAuthority, type FeasibilityProjectType, type FeasibilityRuleVerification } from '@prisma/client'
import { AuditService, type AuditActor } from '../common/audit/audit.service'
import { DomainError } from '../common/errors/domain-error'
import { PrismaService } from '../prisma.service'

/**
 * The registry of rules a feasibility study is measured against: VAT, betterment
 * levy rates, minimum parking standards, required developer margin, and the rest
 * of the numbers that come from somewhere other than this project.
 *
 * ── WHY A TABLE AND NOT A CONSTANT ─────────────────────────────────────────
 *
 * Every one of these numbers has a DATE. VAT was 17% and is 18%. A parking
 * standard is replaced when the plan that set it is replaced. An appraisal does
 * not ask "what is the VAT rate" but "what was the VAT rate on the determining
 * date of this project" (`FeasibilityProfile.valuationDate`, the מועד קובע). A
 * constant in the source answers the first question and silently gets the second
 * one wrong for every project whose determining date is not today — and gets it
 * wrong RETROACTIVELY, changing an already-signed report the next time it is
 * recalculated.
 *
 * So a rule is a row with a window, and resolution takes a date.
 *
 * ── WHY OVERLAP IS AN ERROR ────────────────────────────────────────────────
 *
 * If two rows for the same code are both in force on the determining date, the
 * tempting behaviour is to take the newer one. That is the single worst thing
 * this service could do: it would produce an authoritative-looking number that
 * does not follow from a stated rule, and nobody would find out, because the
 * output looks exactly like the correct case. Overlap means the registry is
 * WRONG, and a wrong registry must stop an appraisal rather than flavour it.
 *
 * Absence is different and is NOT an error: a tenant that has not populated a
 * code gets `null`, and the caller decides whether that is fatal. That keeps
 * this additive — an empty registry changes no existing calculation.
 */

/** A rule as the caller should use it, with the lookup that produced it. */
export interface ResolvedRule {
  code: string
  name: string
  authority: FeasibilityRuleAuthority
  jurisdiction: string | null
  numericValue: Prisma.Decimal | null
  textValue: string | null
  unit: string | null
  effectiveFrom: Date
  effectiveUntil: Date | null
  verification?: FeasibilityRuleVerification
  verificationNote?: string | null
  sourceReference: string
  sourceUrl: string | null
  /** The row, so a report can cite the exact version it used. */
  ruleId: string
  /**
   * True when the value came from a rule limited to this project's
   * jurisdiction rather than the nationwide default. Worth showing: a local
   * standard is the usual reason two similar projects get different numbers.
   */
  jurisdictionSpecific: boolean
}

/** How a project's own assumption compares to the rule in force for it. */
export interface RuleDeviation {
  code: string
  ruleName: string
  ruleValue: Prisma.Decimal | null
  ruleUnit: string | null
  assumptionValue: Prisma.Decimal | null
  sourceReference: string
  ruleId: string
  /**
   * MATCHES — the project used the standard.
   * OVERRIDES — the project deliberately used something else. Not wrong, but it
   *   is what a reviewer must look at, and what an opposing appraiser looks at
   *   first.
   * UNSET — the registry has a rule the project never recorded an assumption
   *   for, so the calculation used the engine's own fallback.
   */
  status: 'MATCHES' | 'OVERRIDES' | 'UNSET' | 'NOT_APPLICABLE' | 'UNMAPPED'
  /** Which assumption key actually answered this rule, when one did. */
  matchedAssumptionKey?: string | null
}

/**
 * ── WHAT A RULE IS ABOUT, IN THE ENGINE'S OWN VOCABULARY ──────────────────
 *
 * The registry keys a rule by its regulatory name — `minimum-developer-profit-
 * tama38`. The engine reads its assumptions by a different name for the same
 * quantity — `required-developer-profit-margin`. Nothing joined the two, so
 * the comparison looked for an assumption under the REGULATION's name, never
 * found one, and every rule came back UNSET on a study that had stated the
 * value all along. The only way to make a rule match was to enter the same
 * number twice under two keys.
 *
 * This table is the join, and it is not a rename in either direction, because
 * the two vocabularies are not in bijection:
 *
 *  - Two rules — the TAMA 38 and the pinuy-binuy profit floors — are about the
 *    SAME engine assumption, and which of them applies depends on what kind of
 *    project this is. Renaming either onto the engine's key would collide;
 *    comparing both against one assumption would mark one of them OVERRIDES
 *    for no reason other than that the other kind of project exists.
 *  - Two rules — VAT and the pinuy-binuy betterment exemption — have no engine
 *    assumption at all. They are reference values a reviewer checks the study
 *    against, and the study's own register is the only place they live. An
 *    empty alias list says that deliberately rather than by omission.
 *
 * Adding a rule without adding it here is a test failure, not a silent UNSET:
 * see `feasibility-rules-mapping.spec.ts`. An unmapped code reaching runtime
 * is reported as UNMAPPED so it is visible rather than indistinguishable from
 * a value nobody filled in.
 */
export interface RuleBinding {
  /** Assumption keys that answer this rule, in priority order. Empty = the rule's own code only. */
  assumptionKeys: readonly string[]
  /** Project types the rule governs. Omitted means it governs all of them. */
  appliesTo?: readonly FeasibilityProjectType[]
}

export const RULE_BINDINGS: Readonly<Record<string, RuleBinding>> = {
  'minimum-developer-profit-tama38': {
    assumptionKeys: ['required-developer-profit-margin', 'minimum-profit-margin'],
    appliesTo: ['TAMA_38_1', 'TAMA_38_2'],
  },
  'minimum-developer-profit-pinuy-binuy': {
    assumptionKeys: ['required-developer-profit-margin', 'minimum-profit-margin'],
    appliesTo: ['PINUY_BINUY'],
  },
  // No engine assumption: the model's basis is VAT-excluded throughout, so
  // there is no rate for the engine to read. The register is where a study
  // records the rate it worked to, and that is what this compares against.
  'vat-rate': { assumptionKeys: [] },
  // Betterment is a cost line, not an assumption. Same reasoning.
  'betterment-levy-rate-pinuy-binuy': { assumptionKeys: [], appliesTo: ['PINUY_BINUY'] },
}

export interface RuleWrite {
  code: string
  name: string
  authority: FeasibilityRuleAuthority
  jurisdiction?: string | null
  numericValue?: number | string | Prisma.Decimal | null
  textValue?: string | null
  unit?: string | null
  effectiveFrom: Date | string
  effectiveUntil?: Date | string | null
  sourceReference: string
  sourceUrl?: string | null
  verification?: FeasibilityRuleVerification
  verificationNote?: string | null
  notes?: string | null
  isActive?: boolean
}

@Injectable()
export class FeasibilityRulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * The rule in force for `code` on `onDate`.
   *
   * The window is HALF-OPEN: `effectiveFrom <= onDate < effectiveUntil`. Closed
   * at both ends would make the last day of one rule and the first day of its
   * successor both match, so the commonest possible data entry — ending a rule
   * on the day the next begins — would trip the overlap error on that one day.
   * Half-open makes consecutive windows the natural way to write history.
   *
   * Returns null when the tenant has no rule for this code on this date.
   */
  async resolve(
    tenantId: string,
    code: string,
    onDate: Date,
    jurisdiction?: string | null,
  ): Promise<ResolvedRule | null> {
    if (Number.isNaN(onDate.getTime())) {
      throw DomainError.validation('RULE_DATE_INVALID', 'A rule can only be resolved against a real date', 'onDate')
    }

    const inForce = await this.prisma.feasibilityRule.findMany({
      where: {
        tenantId,
        code,
        isActive: true,
        effectiveFrom: { lte: onDate },
        OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: onDate } }],
        // Without a jurisdiction only the nationwide rules are eligible: a
        // local standard must never be applied to a project in another city.
        ...(jurisdiction ? {} : { jurisdiction: null }),
      },
      orderBy: { effectiveFrom: 'desc' },
    })

    const eligible = jurisdiction
      ? inForce.filter((rule) => rule.jurisdiction === null || rule.jurisdiction === jurisdiction)
      : inForce
    if (eligible.length === 0) return null

    // A rule written for this municipality beats the nationwide default. This is
    // the whole reason `jurisdiction` is nullable rather than a required string:
    // most rules are national, and the local ones are exceptions layered on top.
    const specific = eligible.filter((rule) => rule.jurisdiction !== null)
    const applicable = specific.length > 0 ? specific : eligible

    if (applicable.length > 1) {
      throw DomainError.conflict(
        'RULE_WINDOWS_OVERLAP',
        `Rule "${code}" has ${applicable.length} versions in force on ${isoDay(onDate)} ` +
        `(${applicable.map((rule) => rule.id).join(', ')}). Close the earlier one before the later one ` +
        'begins — a feasibility study cannot be produced while it is ambiguous which version applies.',
      )
    }

    return this.toResolved(applicable[0])
  }

  /** Resolve several codes for one date, for a report header or a deviations table. */
  async resolveMany(
    tenantId: string,
    codes: readonly string[],
    onDate: Date,
    jurisdiction?: string | null,
  ): Promise<Map<string, ResolvedRule>> {
    const resolved = new Map<string, ResolvedRule>()
    for (const code of new Set(codes)) {
      const rule = await this.resolve(tenantId, code, onDate, jurisdiction)
      if (rule) resolved.set(code, rule)
    }
    return resolved
  }

  /**
   * How one project's assumptions stand against the registry on its determining
   * date.
   *
   * READ-ONLY, and deliberately so. It changes no number and feeds no
   * calculation — it reports. An appraiser signs off on the deviations; they are
   * not applied on their behalf.
   */
  async deviationsForProfile(profileId: string, tenantId: string, scenarioId?: string | null): Promise<{
    valuationDate: Date
    jurisdiction: string | null
    projectType: FeasibilityProjectType
    projectTypeSource: 'SCENARIO' | 'PROFILE'
    deviations: RuleDeviation[]
  }> {
    const profile = await this.prisma.feasibilityProfile.findFirst({
      where: { id: profileId, tenantId },
      include: { assumptions: true, project: { select: { city: true } }, scenarios: { select: { id: true, projectType: true } } },
    })
    if (!profile) throw DomainError.notFound('FEASIBILITY_PROFILE_NOT_FOUND', 'Feasibility profile not found')

    /*
     * `appliesTo` has to read the route the SCENARIO models, not the file's
     * default, or a combination scenario in a purchase file gets measured
     * against a purchase file's rules. Without a scenario the file's default
     * is the honest answer — and the source is reported either way, so a
     * caller can see which question was answered.
     */
    const scenario = scenarioId ? profile.scenarios.find((row) => row.id === scenarioId) : undefined
    if (scenarioId && !scenario) throw DomainError.notFound('FEASIBILITY_SCENARIO_NOT_FOUND', 'Scenario not found in this profile')
    const route = effectiveProjectType(profile.projectType, scenario?.projectType ?? null)

    // The project's city is its jurisdiction: that is what a municipal parking
    // standard or a local plan is scoped by.
    const jurisdiction = profile.project?.city ?? null

    const codes = await this.prisma.feasibilityRule.findMany({
      where: { tenantId, isActive: true },
      select: { code: true },
      distinct: ['code'],
      orderBy: { code: 'asc' },
    })

    const deviations: RuleDeviation[] = []
    for (const { code } of codes) {
      const rule = await this.resolve(tenantId, code, profile.valuationDate, jurisdiction)
      if (!rule) continue

      const binding = RULE_BINDINGS[code]
      /*
       * The rule's own code is always tried first: a study may record a value
       * under the regulation's name directly, and that should keep working.
       * The engine's own keys are then tried in order, so a study that simply
       * stated its profit margin the way the engine reads it is compared
       * against the regulation without anybody entering the number twice.
       */
      const candidateKeys = [code, ...(binding?.assumptionKeys ?? [])]
      const matched = candidateKeys
        .map((key) => profile.assumptions.find((row) => row.key === key && row.value !== null))
        .find((row) => row !== undefined)

      const applies = !binding?.appliesTo || binding.appliesTo.includes(route.projectType)
      const status: RuleDeviation['status'] =
        !binding
          ? 'UNMAPPED'
          : !applies
            ? 'NOT_APPLICABLE'
            : !matched || matched.value === null
              ? 'UNSET'
              : rule.numericValue !== null && matched.value.equals(rule.numericValue)
                ? 'MATCHES'
                : 'OVERRIDES'

      deviations.push({
        code,
        ruleName: rule.name,
        ruleValue: rule.numericValue,
        ruleUnit: rule.unit,
        assumptionValue: status === 'NOT_APPLICABLE' ? null : matched?.value ?? null,
        matchedAssumptionKey: status === 'MATCHES' || status === 'OVERRIDES' ? matched?.key ?? null : null,
        sourceReference: rule.sourceReference,
        ruleId: rule.ruleId,
        status,
      })
    }

    // The ones a reviewer must look at, first.
    // UNMAPPED sits second because it is a configuration fault, not a finding
    // about the study, and whoever reads this should notice it immediately.
    const order = { OVERRIDES: 0, UNMAPPED: 1, UNSET: 2, MATCHES: 3, NOT_APPLICABLE: 4 } as const
    deviations.sort((a, b) => order[a.status] - order[b.status] || a.code.localeCompare(b.code))
    return { valuationDate: profile.valuationDate, jurisdiction, projectType: route.projectType, projectTypeSource: route.source, deviations }
  }

  async list(
    tenantId: string,
    filters: { code?: string; jurisdiction?: string; includeInactive?: boolean; verification?: FeasibilityRuleVerification } = {},
  ): Promise<FeasibilityRule[]> {
    return this.prisma.feasibilityRule.findMany({
      where: {
        tenantId,
        ...(filters.code ? { code: filters.code } : {}),
        ...(filters.jurisdiction ? { jurisdiction: filters.jurisdiction } : {}),
        ...(filters.includeInactive ? {} : { isActive: true }),
        // "What in this register has nobody checked?" has to be a query the
        // register can answer, which is the whole reason verification is a
        // column and not a sentence in `notes`.
        ...(filters.verification ? { verification: filters.verification } : {}),
      },
      orderBy: [{ code: 'asc' }, { effectiveFrom: 'desc' }],
    })
  }

  async create(tenantId: string, dto: RuleWrite, actor: AuditActor): Promise<FeasibilityRule> {
    const data = this.validated(dto)
    await this.assertNoOverlap(tenantId, data, null)

    const created = await this.prisma.feasibilityRule.create({
      data: { ...data, tenantId, createdById: actor.userId, updatedById: actor.userId },
    })
    await this.audit.record(actor, {
      action: 'CREATE',
      entity: 'FeasibilityRule',
      entityId: created.id,
      changes: {
        after: {
          code: created.code,
          effectiveFrom: created.effectiveFrom,
          numericValue: created.numericValue,
        },
      },
    })
    return created
  }

  async update(id: string, tenantId: string, dto: Partial<RuleWrite>, actor: AuditActor): Promise<FeasibilityRule> {
    const before = await this.prisma.feasibilityRule.findFirst({ where: { id, tenantId } })
    if (!before) throw DomainError.notFound('FEASIBILITY_RULE_NOT_FOUND', 'Rule not found')

    const merged = this.validated({ ...this.toWrite(before), ...dto })
    await this.assertNoOverlap(tenantId, merged, id)

    const updated = await this.prisma.feasibilityRule.update({
      where: { id },
      data: { ...merged, updatedById: actor.userId },
    })
    await this.audit.record(actor, {
      action: 'UPDATE',
      entity: 'FeasibilityRule',
      entityId: id,
      changes: AuditService.diff(before, updated),
    })
    return updated
  }

  /**
   * Rules are RETIRED, never deleted.
   *
   * A signed report cites the rule version it used. Deleting the row would make
   * that citation dangle and the report unreproducible, which is the one thing
   * an appraisal must never be. Closing the window keeps history intact and
   * stops the rule applying to anything new.
   */
  async retire(id: string, tenantId: string, effectiveUntil: Date, actor: AuditActor): Promise<FeasibilityRule> {
    const before = await this.prisma.feasibilityRule.findFirst({ where: { id, tenantId } })
    if (!before) throw DomainError.notFound('FEASIBILITY_RULE_NOT_FOUND', 'Rule not found')
    if (Number.isNaN(effectiveUntil.getTime()) || effectiveUntil <= before.effectiveFrom) {
      throw DomainError.validation(
        'RULE_WINDOW_INVALID',
        'A rule cannot stop applying before it started',
        'effectiveUntil',
      )
    }

    const updated = await this.prisma.feasibilityRule.update({
      where: { id },
      data: { effectiveUntil, updatedById: actor.userId },
    })
    await this.audit.record(actor, {
      action: 'UPDATE',
      entity: 'FeasibilityRule',
      entityId: id,
      changes: { before: { effectiveUntil: before.effectiveUntil }, after: { effectiveUntil } },
    })
    return updated
  }

  // ── internals ────────────────────────────────────────────────────────────

  private toResolved(rule: FeasibilityRule): ResolvedRule {
    return {
      code: rule.code,
      name: rule.name,
      authority: rule.authority,
      jurisdiction: rule.jurisdiction,
      numericValue: rule.numericValue,
      textValue: rule.textValue,
      unit: rule.unit,
      effectiveFrom: rule.effectiveFrom,
      effectiveUntil: rule.effectiveUntil,
      sourceReference: rule.sourceReference,
      sourceUrl: rule.sourceUrl,
      verification: rule.verification,
      verificationNote: rule.verificationNote,
      ruleId: rule.id,
      jurisdictionSpecific: rule.jurisdiction !== null,
    }
  }

  private toWrite(rule: FeasibilityRule): RuleWrite {
    return {
      code: rule.code,
      name: rule.name,
      authority: rule.authority,
      jurisdiction: rule.jurisdiction,
      numericValue: rule.numericValue,
      textValue: rule.textValue,
      unit: rule.unit,
      effectiveFrom: rule.effectiveFrom,
      effectiveUntil: rule.effectiveUntil,
      sourceReference: rule.sourceReference,
      sourceUrl: rule.sourceUrl,
      verification: rule.verification,
      verificationNote: rule.verificationNote,
      notes: rule.notes,
      isActive: rule.isActive,
    }
  }

  private validated(dto: RuleWrite) {
    const code = dto.code?.trim()
    if (!code) throw DomainError.validation('RULE_CODE_REQUIRED', 'A rule needs a code', 'code')

    // The citation is not optional. A number in this table without a source is
    // indistinguishable from somebody's recollection, and the entire purpose of
    // the registry is that an appraisal can point at where each figure came from.
    const sourceReference = dto.sourceReference?.trim()
    if (!sourceReference) {
      throw DomainError.validation(
        'RULE_SOURCE_REQUIRED',
        'A rule needs a citation — the section, plan or circular it comes from',
        'sourceReference',
      )
    }

    const effectiveFrom = new Date(dto.effectiveFrom)
    if (Number.isNaN(effectiveFrom.getTime())) {
      throw DomainError.validation('RULE_WINDOW_INVALID', 'effectiveFrom must be a real date', 'effectiveFrom')
    }
    const effectiveUntil = dto.effectiveUntil ? new Date(dto.effectiveUntil) : null
    if (effectiveUntil && Number.isNaN(effectiveUntil.getTime())) {
      throw DomainError.validation('RULE_WINDOW_INVALID', 'effectiveUntil must be a real date', 'effectiveUntil')
    }
    if (effectiveUntil && effectiveUntil <= effectiveFrom) {
      throw DomainError.validation(
        'RULE_WINDOW_INVALID',
        'A rule cannot stop applying before it started',
        'effectiveUntil',
      )
    }

    if (dto.numericValue == null && !dto.textValue?.trim()) {
      throw DomainError.validation(
        'RULE_VALUE_REQUIRED',
        'A rule needs either a numeric or a textual value',
        'numericValue',
      )
    }

    return {
      code,
      name: dto.name?.trim() || code,
      authority: dto.authority,
      jurisdiction: dto.jurisdiction?.trim() || null,
      numericValue: dto.numericValue == null ? null : new Prisma.Decimal(dto.numericValue),
      textValue: dto.textValue?.trim() || null,
      unit: dto.unit?.trim() || null,
      effectiveFrom,
      effectiveUntil,
      sourceReference,
      sourceUrl: dto.sourceUrl?.trim() || null,
      // Omitted means unverified, not verified: the column defaults to
      // NEEDS_VERIFICATION and nothing here quietly upgrades it.
      ...(dto.verification ? { verification: dto.verification } : {}),
      verificationNote: dto.verificationNote?.trim() || null,
      notes: dto.notes?.trim() || null,
      isActive: dto.isActive ?? true,
    }
  }

  /**
   * Refuse a row that would make some date ambiguous.
   *
   * Caught on WRITE as well as on read, because by the time an overlap surfaces
   * during a resolve it is blocking somebody's report, and the person who can
   * explain it is whoever typed the second row — possibly weeks earlier.
   */
  private async assertNoOverlap(
    tenantId: string,
    data: {
      code: string
      jurisdiction: string | null
      effectiveFrom: Date
      effectiveUntil: Date | null
      isActive: boolean
    },
    excludeId: string | null,
  ): Promise<void> {
    if (!data.isActive) return

    const clashes = await this.prisma.feasibilityRule.findMany({
      where: {
        tenantId,
        code: data.code,
        jurisdiction: data.jurisdiction,
        isActive: true,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        // Two half-open windows overlap when each starts before the other ends.
        AND: [
          data.effectiveUntil ? { effectiveFrom: { lt: data.effectiveUntil } } : {},
          { OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: data.effectiveFrom } }] },
        ],
      },
      select: { id: true, effectiveFrom: true, effectiveUntil: true },
      take: 1,
    })

    if (clashes.length > 0) {
      const existing = clashes[0]
      const scope = data.jurisdiction ? ` for ${data.jurisdiction}` : ''
      const until = existing.effectiveUntil ? `to ${isoDay(existing.effectiveUntil)}` : 'onwards'
      throw DomainError.conflict(
        'RULE_WINDOWS_OVERLAP',
        `Rule "${data.code}"${scope} already has a version in force from ${isoDay(existing.effectiveFrom)} ${until}. ` +
        'Close that version first — two versions of one rule cannot both apply.',
      )
    }
  }
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10)
}
