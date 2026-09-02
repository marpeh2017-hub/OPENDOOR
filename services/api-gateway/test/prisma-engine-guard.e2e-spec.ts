/**
 * Guard against a silent, cross-tool failure mode.
 *
 * Running `prisma generate` with Accelerate flags (`--no-engine`, or
 * PRISMA_CLIENT_ENGINE_TYPE=dataproxy) rewrites the SHARED generated client
 * under node_modules. The schema is untouched, git stays clean, and the API
 * then dies on every query with "the URL must start with prisma://" — a
 * message that names neither the cause nor the fix.
 *
 * This is not hypothetical: it took the API down in this repository, where more
 * than one agent works at once and either may run `prisma generate`.
 *
 * These are pure-function tests on purpose. They need no database, no Nest
 * bootstrap and no filesystem, so they cannot themselves be affected by the
 * condition they describe.
 */
import { checkPrismaEngine, queryEngineBinaryExists } from '../src/config/prisma-engine.validator'

const PG = 'postgresql://postgres:postgres@127.0.0.1:5432/urban_renewal_os'

describe('Prisma engine guard', () => {
  it('passes for a direct PostgreSQL URL with a local query engine', () => {
    expect(checkPrismaEngine(PG, true)).toEqual({ ok: true })
  })

  it('passes for an Accelerate URL with no local engine — that combination is valid', () => {
    expect(checkPrismaEngine('prisma://accelerate.prisma-data.net/?api_key=x', false))
      .toEqual({ ok: true })
    expect(checkPrismaEngine('prisma+postgres://localhost:51213/?api_key=x', false))
      .toEqual({ ok: true })
  })

  it('FAILS for a direct PostgreSQL URL with no local engine — the real outage', () => {
    const result = checkPrismaEngine(PG, false)
    expect(result.ok).toBe(false)
    // The whole point is that the message is actionable, so assert it says what
    // to run rather than merely that it failed.
    expect(result.reason).toContain('no local query engine')
    expect(result.remedy).toContain('pnpm db:generate')
    expect(result.remedy).toContain('--no-engine')
  })

  it('FAILS when DATABASE_URL is unset, and says where to set it', () => {
    const result = checkPrismaEngine(undefined, true)
    expect(result.ok).toBe(false)
    expect(result.remedy).toContain('services/api-gateway/.env')
  })

  it('treats an empty DATABASE_URL as unset rather than as a direct URL', () => {
    expect(checkPrismaEngine('', true).ok).toBe(false)
  })

  /**
   * The guard's other half, and the half that actually broke.
   *
   * `queryEngineBinaryExists` looked for the generated client one level up from
   * `@prisma/client`, at `@prisma/.prisma/client`. That path does not exist in
   * any layout: the generated client is a SIBLING of the `@prisma` scope
   * directory, at `<node_modules>/.prisma/client`, two levels up. So the lookup
   * always returned false, and a healthy client with a working engine was
   * reported as an Accelerate build — the guard against a confusing outage
   * became a confusing outage of its own, and refused to boot the API.
   *
   * Unlike the tests above this one does touch the filesystem, deliberately: the
   * bug was entirely in the path arithmetic, so a mocked filesystem would have
   * reproduced the mistake rather than caught it.
   */
  it('finds the query engine that this repository actually has installed', () => {
    expect(queryEngineBinaryExists()).toBe(true)
  })
})
