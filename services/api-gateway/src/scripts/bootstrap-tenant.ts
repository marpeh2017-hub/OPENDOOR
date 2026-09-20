/**
 * Production bootstrap — the first tenant and its first administrator.
 *
 * ── WHY THIS IS NOT `db:seed` ───────────────────────────────────────────────
 *
 * `packages/db/prisma/seed.ts` is DEMO data: three projects, six residents,
 * owners, leads, tasks. It hard-exits when `NODE_ENV=production` and its npm
 * script pins `NODE_ENV=development`, both of which are correct — nobody wants
 * "הרצל 45 תל אביב" appearing in a real deployment.
 *
 * But that left production with no way to create the one row a fresh database
 * genuinely needs: a tenant, and a user who can log in and create everything
 * else. This script is that, and only that.
 *
 * ── WHAT IT WILL NOT DO ─────────────────────────────────────────────────────
 *
 *   - It will not invent a password. A default admin credential in a bootstrap
 *     script is a backdoor with a changelog entry; the password comes from the
 *     environment or the script refuses to run.
 *   - It will not print the password, or the hash, or write either to an audit
 *     row.
 *   - It will not modify an existing tenant or user. Re-running it on a
 *     populated database reports what already exists and changes nothing, so it
 *     is safe in a deploy pipeline that runs it every time.
 *   - It will not create projects, buildings or residents. Those are the
 *     operator's data, not the installer's.
 *
 * ── USAGE ───────────────────────────────────────────────────────────────────
 *
 *   BOOTSTRAP_TENANT_NAME="OpenDoor Group" \
 *   BOOTSTRAP_TENANT_SLUG="opendoor" \
 *   BOOTSTRAP_ADMIN_EMAIL="admin@opendoor.co.il" \
 *   BOOTSTRAP_ADMIN_PASSWORD="..." \
 *   pnpm --filter @urban-renewal/api-gateway bootstrap
 *
 * It lives under `src/` so `nest build` compiles it to
 * `dist/scripts/bootstrap-tenant.js`. A production image installs no dev
 * dependencies, so a `tsx`-run script in `scripts/` would not exist there —
 * which is exactly when the bootstrap is needed.
 *
 * Password hashing goes through the SAME `hashPassword` the login path uses, so
 * a bootstrapped admin cannot end up in a format the verifier does not accept.
 */
import { PrismaClient, UserRole } from '@prisma/client'
import { hashPassword } from '../auth/auth.service'

const prisma = new PrismaClient()

/** Minimum length for the bootstrap admin password. */
const MIN_PASSWORD_LENGTH = 12

/** Passwords that are common enough to be in any wordlist. Not a policy — a floor. */
const REFUSED_PASSWORDS = new Set([
  'password', 'password123', 'admin1234', 'demo1234', 'changeme123',
  'administrator', 'opendoor123', '123456789012',
])

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    console.error(`✖ ${name} is required.`)
    process.exit(1)
  }
  return value
}

function assertUsablePassword(password: string): void {
  const problems: string[] = []
  if (password.length < MIN_PASSWORD_LENGTH) problems.push(`at least ${MIN_PASSWORD_LENGTH} characters`)
  if (!/[a-z]/.test(password)) problems.push('a lowercase letter')
  if (!/[A-Z]/.test(password)) problems.push('an uppercase letter')
  if (!/\d/.test(password)) problems.push('a digit')
  if (REFUSED_PASSWORDS.has(password.toLowerCase())) problems.push('something not in a wordlist')

  if (problems.length > 0) {
    // The password itself is never echoed, only what it lacks.
    console.error(`✖ BOOTSTRAP_ADMIN_PASSWORD needs ${problems.join(', ')}.`)
    process.exit(1)
  }
}

/** Slugs are used in URLs and as the tenant's stable public identifier. */
function assertUsableSlug(slug: string): void {
  if (!/^[a-z0-9]([a-z0-9-]{1,48}[a-z0-9])?$/.test(slug)) {
    console.error('✖ BOOTSTRAP_TENANT_SLUG must be 3-50 lowercase letters, digits or hyphens, and may not start or end with a hyphen.')
    process.exit(1)
  }
}

async function main() {
  const tenantName = required('BOOTSTRAP_TENANT_NAME')
  const tenantSlug = required('BOOTSTRAP_TENANT_SLUG').toLowerCase()
  const adminEmail = required('BOOTSTRAP_ADMIN_EMAIL').toLowerCase()
  const adminPassword = required('BOOTSTRAP_ADMIN_PASSWORD')
  const adminPhone = process.env.BOOTSTRAP_ADMIN_PHONE?.trim() || null
  const adminFirstName = process.env.BOOTSTRAP_ADMIN_FIRST_NAME?.trim() || 'System'
  const adminLastName = process.env.BOOTSTRAP_ADMIN_LAST_NAME?.trim() || 'Administrator'

  assertUsableSlug(tenantSlug)
  assertUsablePassword(adminPassword)

  console.log(`→ Bootstrapping tenant "${tenantSlug}" …`)

  const existingTenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug }, select: { id: true, name: true } })

  const tenant = existingTenant ?? await prisma.tenant.create({
    data: { name: tenantName, slug: tenantSlug, isActive: true },
    select: { id: true, name: true },
  })
  console.log(existingTenant ? `  tenant already exists — left unchanged (${tenant.name})` : `  tenant created: ${tenant.name}`)

  const existingAdmin = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email: adminEmail },
    select: { id: true, role: true, isActive: true },
  })

  if (existingAdmin) {
    // Deliberately does NOT reset the password. A bootstrap script that can
    // overwrite an administrator's credentials is a privilege-escalation tool
    // for anyone who can set environment variables on the host.
    console.log(`  admin already exists — left unchanged (role ${existingAdmin.role}, active ${existingAdmin.isActive})`)
    console.log('\n✓ Nothing to do. Bootstrap is idempotent; re-running it never modifies existing rows.')
    return
  }

  const admin = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: adminEmail,
      phone: adminPhone,
      passwordHash: hashPassword(adminPassword),
      firstName: adminFirstName,
      lastName: adminLastName,
      role: UserRole.COMPANY_ADMIN,
      isActive: true,
      isVerified: true,
    },
    select: { id: true, email: true },
  })
  console.log(`  admin created: ${admin.email}`)

  // The bootstrap admin is its own actor — there is no earlier user to
  // attribute this to, and inventing one would be worse than saying so.
  await prisma.auditLog.create({
    data: {
      tenantId: tenant.id,
      userId: admin.id,
      action: 'CREATE',
      entity: 'Tenant',
      entityId: tenant.id,
      metadata: {
        source: 'bootstrap-tenant script',
        tenantSlug,
        adminEmail,
        note: 'Initial tenant and administrator created by the production bootstrap.',
      },
    },
  })

  console.log('\n✓ Bootstrap complete.')
  console.log('  Sign in with the email and password you supplied, then change the password.')
  console.log('  This script created NO projects, buildings or residents by design.')
}

main()
  .catch((error) => {
    // Never let a Prisma error echo the data it was writing.
    console.error('✖ Bootstrap failed:', error instanceof Error ? error.message : 'unknown error')
    process.exit(1)
  })
  .finally(async () => { await prisma.$disconnect() })
