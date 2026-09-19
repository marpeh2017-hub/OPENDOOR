/**
 * Template variable extraction and rendering.
 *
 * Pure functions — no Prisma, no I/O — so the substitution rules can be tested
 * directly rather than through an HTTP round trip.
 *
 * SYNTAX: `{{variableName}}`, optionally padded (`{{ firstName }}`). Names are
 * ASCII identifiers; the surrounding TEXT is Hebrew, but a variable name is a
 * code-level key that also has to survive being typed into a WhatsApp template
 * console, so it is deliberately restricted.
 */

/** Matches one placeholder and captures its name. */
const PLACEHOLDER = /\{\{\s*([A-Za-z][A-Za-z0-9_]*)\s*\}\}/g

/** Chosen to bound render cost; also the DB column is unbounded text. */
export const MAX_TEMPLATE_BODY = 4000
export const MAX_RENDERED_LENGTH = 20000

export class TemplateRenderError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message)
  }
}

/**
 * Every distinct variable used in the template, in first-appearance order.
 *
 * This is why `CommunicationTemplate.variables` is DERIVED on write rather than
 * accepted from the client: two sources of truth for "which variables does this
 * template need" drift the moment someone edits the body and forgets the list,
 * and the failure mode is a resident receiving a message with a raw
 * `{{firstName}}` in it.
 */
export function extractVariables(...parts: (string | null | undefined)[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of parts) {
    if (!part) continue
    for (const m of part.matchAll(PLACEHOLDER)) {
      const name = m[1]!
      if (!seen.has(name)) {
        seen.add(name)
        out.push(name)
      }
    }
  }
  return out
}

/**
 * Substitute values into a template body.
 *
 * STRICT BY DESIGN. A missing value throws rather than rendering an empty
 * string or leaving the placeholder visible: this text is sent to residents
 * about a legally consequential process, and "שלום ," or a literal
 * "{{firstName}}" reaching a person is worse than the send failing loudly.
 *
 * SINGLE PASS. Replacement is done by one `replace` over the source, so a VALUE
 * that happens to contain `{{something}}` is inserted literally and never
 * re-expanded. Without this, resident-supplied data (a name, an address free
 * text field) could reach back into the template and pull in another variable's
 * contents.
 *
 * NO ESCAPING is applied. These bodies go to SMS, WhatsApp and plain-text email
 * where there is no markup to escape; if an HTML email channel is added later,
 * escaping belongs in that channel's provider, not here, because only the
 * provider knows the output grammar.
 */
export function renderTemplate(
  source: string,
  values: Record<string, string | number | null | undefined>,
): string {
  const missing: string[] = []
  const rendered = source.replace(PLACEHOLDER, (_full, rawName: string) => {
    const value = values[rawName]
    if (value === undefined || value === null || value === '') {
      missing.push(rawName)
      return ''
    }
    return String(value)
  })

  if (missing.length > 0) {
    throw new TemplateRenderError(
      'Template is missing values for one or more variables',
      'TEMPLATE_VARIABLES_MISSING',
      { missing: [...new Set(missing)] },
    )
  }
  if (rendered.length > MAX_RENDERED_LENGTH) {
    throw new TemplateRenderError(
      'Rendered template exceeds the maximum message length',
      'TEMPLATE_RENDERED_TOO_LONG',
      { length: rendered.length, max: MAX_RENDERED_LENGTH },
    )
  }
  return rendered
}
