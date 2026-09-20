/**
 * Fails fast, and legibly, when the generated Prisma Client cannot talk to a
 * normal PostgreSQL server.
 *
 * ── THE FAILURE THIS EXISTS FOR ────────────────────────────────────────────
 *
 * Running `prisma generate` with Accelerate enabled (`--no-engine`, or an
 * `engineType`/`PRISMA_CLIENT_ENGINE_TYPE` set to `dataproxy`) produces a
 * client that speaks only to `prisma://`. Nothing in the schema changes, so
 * `git status` is clean and the schema still says `provider = "postgresql"` —
 * but every query then dies with:
 *
 *     the URL must start with the protocol `prisma://` or `prisma+postgres://`
 *
 * That message names neither the cause nor the fix. It cost a real debugging
 * session: the API had been healthy minutes earlier, the DATABASE_URL was
 * correct, and nothing in the working tree had changed.
 *
 * It matters especially here because more than one agent/tool works in this
 * repository at once. A `prisma generate` run by ANY of them, with different
 * flags, silently re-writes the shared generated client under `node_modules`.
 *
 * ── WHY A STARTUP CHECK RATHER THAN A COMMENT ──────────────────────────────
 *
 * The condition is invisible in source control and produces a runtime error
 * that reads like a configuration mistake. Detecting it at boot turns a
 * confusing outage into one line that says exactly what to run.
 */

export interface PrismaEngineCheckResult {
  ok: boolean
  reason?: string
  remedy?: string
}

/**
 * Pure, so it can be unit-tested without booting Nest or touching the client.
 *
 * `datasourceUrl` is what the app will actually connect with; `clientPath` is
 * the resolved path of the generated client, used only to look for the query
 * engine binary alongside it.
 */
export function checkPrismaEngine(
  datasourceUrl: string | undefined,
  hasQueryEngineBinary: boolean,
): PrismaEngineCheckResult {
  if (!datasourceUrl) {
    return {
      ok: false,
      reason: 'DATABASE_URL is not set.',
      remedy: 'Set DATABASE_URL in services/api-gateway/.env',
    }
  }

  const isAccelerateUrl =
    datasourceUrl.startsWith('prisma://') || datasourceUrl.startsWith('prisma+postgres://')

  // A direct Postgres URL with no local query engine means the client was
  // generated for Accelerate. This is the case that actually bites.
  if (!isAccelerateUrl && !hasQueryEngineBinary) {
    return {
      ok: false,
      reason:
        'The generated Prisma Client has no local query engine, but DATABASE_URL is a ' +
        'direct PostgreSQL URL. The client was generated for Accelerate/Data Proxy ' +
        '(`--no-engine`), so every query will fail with "the URL must start with prisma://".',
      remedy:
        'Regenerate against the canonical schema:\n' +
        '  cd packages/db && pnpm db:generate\n' +
        'Do NOT pass --no-engine, and make sure PRISMA_CLIENT_ENGINE_TYPE / ' +
        'PRISMA_GENERATE_NO_ENGINE are unset.',
    }
  }

  return { ok: true }
}

/**
 * Resolves the generated client and reports whether its query engine binary is
 * present. Kept separate from the pure check so the filesystem lookup can be
 * stubbed in tests.
 */
export function queryEngineBinaryExists(): boolean {
   
  const fs = require('fs') as typeof import('fs')
  const path = require('path') as typeof import('path')
   

  try {
    const entry = require.resolve('@prisma/client')
    const pkgDir = path.dirname(entry)

    // The generated client is emitted to `<node_modules>/.prisma/client`, a
    // SIBLING of the `@prisma` scope directory — so from `@prisma/client` it is
    // two levels up, not one. Under pnpm that is
    //   .../node_modules/@prisma/client        (the package)
    //   .../node_modules/.prisma/client        (the generated client + engine)
    // and a flat npm tree has the same shape. Looking only one level up finds
    // `@prisma/.prisma/client`, which never exists, so the check reported "no
    // engine" for a perfectly healthy client and refused to boot.
    //
    // Both candidates are tried rather than just the corrected one: some
    // versions do emit alongside the package, and this check must not become a
    // second way to fail startup for a client that actually works.
    const candidates = [
      path.join(pkgDir, '..', '..', '.prisma', 'client'),
      path.join(pkgDir, '..', '.prisma', 'client'),
      pkgDir,
    ]

    return candidates.some((dir) => {
      if (!fs.existsSync(dir)) return false
      return fs
        .readdirSync(dir)
        .some((f) => f.startsWith('query_engine') || f.startsWith('libquery_engine'))
    })
  } catch {
    // If the client cannot be resolved at all, a different error will surface
    // first and more clearly. Do not block startup on this check's own failure.
    return true
  }
}

/** Throws with an actionable message when the client cannot reach Postgres. */
export function validatePrismaEngine(): void {
  const result = checkPrismaEngine(process.env['DATABASE_URL'], queryEngineBinaryExists())
  if (result.ok) return

  throw new Error(
    `Prisma Client is unusable with this DATABASE_URL.\n\n` +
    `  Why:  ${result.reason}\n\n` +
    `  Fix:  ${result.remedy}\n`,
  )
}
