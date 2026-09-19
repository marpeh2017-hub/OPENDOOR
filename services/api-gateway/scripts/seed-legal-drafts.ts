/**
 * Seed two DRAFT CmsContent rows so a legal editor has somewhere to work.
 *
 * Neither slug is in CMS_MANAGED_SLUGS, and neither is published here — the
 * website keeps rendering its own honest "in preparation" notice for both
 * until real legal copy exists and someone explicitly migrates the slug.
 * This script writes nothing a visitor can reach.
 */
import { PrismaClient } from '@prisma/client'

const TENANT_SLUG = process.env['CMS_IMPORT_TENANT'] ?? 'opendoor-demo'
const prisma = new PrismaClient()

const PAGES = [
  {
    slug: 'privacy',
    title: { he: 'מדיניות פרטיות', en: 'Privacy policy' },
    heading: { he: 'נדרש תוכן משפטי', en: 'LEGAL CONTENT REQUIRED' },
    body: {
      he: 'טרם קיים נוסח מדיניות פרטיות מאושר. אין להמציא נוסח משפטי: יש להמתין לטקסט הרשמי מבעל התוכן ולהזין אותו כאן. עד אז העמוד הציבורי מציג הודעה כללית בלבד ואינו מתפרסם מה-CMS.',
      en: 'No approved privacy policy text exists yet. Do not invent legal language here — wait for the official text from the content owner and enter it in this block. Until then the public page shows a general notice only and is not served from the CMS.',
    },
  },
  {
    slug: 'terms',
    title: { he: 'תנאי שימוש', en: 'Terms of use' },
    heading: { he: 'נדרש תוכן משפטי', en: 'LEGAL CONTENT REQUIRED' },
    body: {
      he: 'טרם קיים נוסח תנאי שימוש מאושר. אין להמציא נוסח משפטי: יש להמתין לטקסט הרשמי מבעל התוכן ולהזין אותו כאן. עד אז העמוד הציבורי מציג הודעה כללית בלבד ואינו מתפרסם מה-CMS.',
      en: 'No approved terms-of-use text exists yet. Do not invent legal language here — wait for the official text from the content owner and enter it in this block. Until then the public page shows a general notice only and is not served from the CMS.',
    },
  },
] as const

async function main() {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: TENANT_SLUG } })
  const user = await prisma.user.findFirstOrThrow({
    where: { tenantId: tenant.id, role: { in: ['SUPER_ADMIN', 'COMPANY_ADMIN'] } },
    orderBy: { createdAt: 'asc' },
  })

  for (const page of PAGES) {
    const draft = {
      title: page.title,
      blocks: [
        {
          id: `${page.slug}-legal-required`,
          type: 'PROSE',
          order: 1,
          hidden: false,
          heading: page.heading,
          body: page.body,
        },
      ],
    }

    const existing = await prisma.cmsContent.findFirst({
      where: { tenantId: tenant.id, kind: 'PAGE', slug: page.slug },
    })
    const content = existing
      ? await prisma.cmsContent.update({
          where: { id: existing.id },
          data: { draft: draft as never, updatedById: user.id },
        })
      : await prisma.cmsContent.create({
          data: {
            tenantId: tenant.id, kind: 'PAGE', slug: page.slug,
            state: 'DRAFT', exposure: 'PUBLIC',
            draft: draft as never, createdById: user.id, updatedById: user.id,
          },
        })

    const last = await prisma.cmsRevision.findFirst({
      where: { contentId: content.id }, orderBy: { sequence: 'desc' }, select: { sequence: true },
    })
    const revision = await prisma.cmsRevision.create({
      data: {
        tenantId: tenant.id, contentId: content.id,
        sequence: (last?.sequence ?? 0) + 1, reason: 'SAVE',
        snapshot: draft as never, stateAtRevision: 'DRAFT', authorId: user.id,
        summary: 'סימון: נדרש תוכן משפטי',
      },
    })
    await prisma.cmsContent.update({ where: { id: content.id }, data: { currentRevisionId: revision.id } })

    console.log(`  ${page.slug}: ${existing ? 'updated' : 'created'} DRAFT ${content.id} (state=${content.state}, unpublished)`)
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
