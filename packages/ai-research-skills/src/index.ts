/**
 * @urban-renewal/ai-research-skills
 *
 * Registry of AI research skills available to the platform. A skill is a named,
 * self-describing unit of research work (input -> structured output) that agents
 * and server routes can look up by id.
 */

export interface ResearchSkillContext {
  /** Tenant the skill is running on behalf of. */
  readonly organizationId: string;
  /** Abort signal propagated from the caller's request. */
  readonly signal?: AbortSignal;
}

export interface ResearchSkill<TInput = unknown, TOutput = unknown> {
  /** Stable, kebab-case identifier used for lookup. */
  readonly id: string;
  readonly name: string;
  readonly description: string;
  run(input: TInput, context: ResearchSkillContext): Promise<TOutput>;
}

export type AnyResearchSkill = ResearchSkill<never, unknown>;

const registry = new Map<string, AnyResearchSkill>();

/** Registers a skill. Throws if the id is already taken. */
export function registerSkill<TInput, TOutput>(
  skill: ResearchSkill<TInput, TOutput>,
): void {
  if (registry.has(skill.id)) {
    throw new Error(`Research skill already registered: ${skill.id}`);
  }
  registry.set(skill.id, skill as unknown as AnyResearchSkill);
}

/** Returns the skill with the given id, or undefined when unknown. */
export function getSkill(id: string): AnyResearchSkill | undefined {
  return registry.get(id);
}

/** Lists every registered skill, ordered by id. */
export function listSkills(): readonly AnyResearchSkill[] {
  return [...registry.values()].sort((a, b) => a.id.localeCompare(b.id));
}
