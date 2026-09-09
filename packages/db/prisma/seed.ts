import {
  PrismaClient,
  UserRole,
  ProjectStage,
  LeadStatus,
  LeadSource,
  ResidentSignatureStatus,
} from '@prisma/client'
import { createHash } from 'crypto'

if (process.env.NODE_ENV === 'production') {
  console.error('ERROR: Seed script must not run in production. Set NODE_ENV=development.')
  process.exit(1)
}

const prisma = new PrismaClient()

// Simple SHA-256 hash for demo purposes (not bcrypt — no external dep needed for seed)
function hashPassword(pw: string) {
  return '$sha256$' + createHash('sha256').update(pw).digest('hex')
}

async function main() {
  console.log('🌱 Seeding database...')

  // ── Tenant ─────────────────────────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where:  { slug: 'opendoor-demo' },
    update: {},
    create: {
      id:      'tnt_01',
      name:    'OpenDoor התחדשות עירונית',
      slug:    'opendoor-demo',
      domain:  'opendoor.co.il',
      plan:    'enterprise',
      isActive: true,
    },
  })
  console.log('✅ Tenant:', tenant.name)

  // ── Users ──────────────────────────────────────────────────────────────────
  const passwordHash = hashPassword('demo1234')

  const admin = await prisma.user.upsert({
    where:  { tenantId_email: { tenantId: tenant.id, email: 'admin@opendoor.co.il' } },
    update: {},
    create: {
      id:           'usr_admin_01',
      tenantId:     tenant.id,
      email:        'admin@opendoor.co.il',
      passwordHash,
      firstName:    'מנהל',
      lastName:     'מערכת',
      role:         UserRole.COMPANY_ADMIN,
      phone:        '0548018613',
      isActive:     true,
      isVerified:   true,
    },
  })

  const pm = await prisma.user.upsert({
    where:  { tenantId_email: { tenantId: tenant.id, email: 'avi@opendoor.co.il' } },
    update: {},
    create: {
      id:           'usr_pm_01',
      tenantId:     tenant.id,
      email:        'avi@opendoor.co.il',
      passwordHash,
      firstName:    'אבי',
      lastName:     'שמואלי',
      role:         UserRole.PROJECT_MANAGER,
      phone:        '0521234567',
      isActive:     true,
      isVerified:   true,
    },
  })
  console.log('✅ Users:', admin.email, pm.email)

  // ── Projects ───────────────────────────────────────────────────────────────
  const project1 = await prisma.project.upsert({
    where:  { id: 'prj_001' },
    update: {},
    create: {
      id:              'prj_001',
      tenantId:        tenant.id,
      code:            'TLV-001',
      name:            'הרצל 45 תל אביב',
      address:         'הרצל 45',
      city:            'תל אביב',
      neighborhood:    'לב העיר',
      stage:           ProjectStage.SIGNATURES,
      totalUnits:      48,
      signedUnits:     34,
      signatureGoal:   67,
      projectManagerId: pm.id,
      startDate:       new Date('2023-06-01'),
      targetEndDate:   new Date('2026-12-31'),
    },
  })

  const project2 = await prisma.project.upsert({
    where:  { id: 'prj_002' },
    update: {},
    create: {
      id:              'prj_002',
      tenantId:        tenant.id,
      code:            'TLV-002',
      name:            'ויצמן 12 תל אביב',
      address:         'ויצמן 12',
      city:            'תל אביב',
      neighborhood:    'הצפון הישן',
      stage:           ProjectStage.RESIDENT_ORGANIZATION,
      totalUnits:      32,
      signedUnits:     12,
      signatureGoal:   67,
      projectManagerId: pm.id,
      startDate:       new Date('2024-01-15'),
    },
  })

  const project3 = await prisma.project.upsert({
    where:  { id: 'prj_003' },
    update: {},
    create: {
      id:              'prj_003',
      tenantId:        tenant.id,
      code:            'RMT-001',
      name:            'בן גוריון 8 רמת גן',
      address:         'בן גוריון 8',
      city:            'רמת גן',
      neighborhood:    'מרכז העיר',
      stage:           ProjectStage.PLANNING,
      totalUnits:      64,
      signedUnits:     58,
      signatureGoal:   67,
      projectManagerId: admin.id,
      startDate:       new Date('2022-03-01'),
    },
  })
  console.log('✅ Projects seeded')

  // ── Complex + Building + Apartments (for project1) ─────────────────────────
  const complex = await prisma.complex.upsert({
    where:  { id: 'cmplx_001' },
    update: {},
    create: {
      id:        'cmplx_001',
      projectId: project1.id,
      name:      'מתחם הרצל',
      address:   'הרצל 43-47',
    },
  })

  const building = await prisma.building.upsert({
    where:  { id: 'bldg_001' },
    update: {},
    create: {
      id:              'bldg_001',
      complexId:       complex.id,
      // CreateBuildingDto documents `address` as the street NAME only — the
      // number belongs in streetNumber. Seeding 'הרצל 45' here made the UI
      // render 'הרצל 45 45'.
      address:         'הרצל',
      streetNumber:    '45',
      city:            'תל אביב',
      floors:          8,
      totalApartments: 48,
      constructionYear: 1972,
      buildingClass:   'B',
    },
  })

  // Create apartments
  const aptData = [
    { id: 'apt_001', number: '1',  floor: 1 },
    { id: 'apt_002', number: '2',  floor: 1 },
    { id: 'apt_003', number: '3',  floor: 2 },
    { id: 'apt_004', number: '4',  floor: 2 },
    { id: 'apt_005', number: '5',  floor: 3 },
    { id: 'apt_006', number: '6',  floor: 3 },
  ]
  for (const a of aptData) {
    await prisma.apartment.upsert({
      where:  { buildingId_apartmentNumber: { buildingId: building.id, apartmentNumber: a.number } },
      update: {},
      create: {
        id:              a.id,
        buildingId:      building.id,
        apartmentNumber: a.number,
        floor:           a.floor,
        rooms:           3,
        sizeSqm:         75,
      },
    })
  }
  console.log('✅ Building structure seeded')

  // ── Residents ──────────────────────────────────────────────────────────────
  //
  // NOTE ON THE PHONE NUMBER 0548018613
  //
  // This is a REAL number belonging to the product owner, used deliberately so
  // that SMS flows can be tested against a live handset. It replaced the
  // generic placeholder 0501234567 after an end-to-end audit sent 24 real
  // messages to that placeholder — a number nobody owned and nobody was
  // watching, so a live-send misconfiguration produced no visible signal.
  //
  // Sending is still gated by MESSAGING_SIMULATE, which defaults to ON outside
  // production and must be set explicitly IN production. Flipping it off is now
  // the only way to reach this handset, and that is a deliberate act.
  const residentsData = [
    { id: 'res_01', firstName: 'דוד',  lastName: 'כהן',   phone: '0548018613', email: 'david.cohen@gmail.com',  aptId: 'apt_001', sig: ResidentSignatureStatus.SIGNED },
    { id: 'res_02', firstName: 'רחל',  lastName: 'לוי',   phone: '0529876543', email: 'rachel.levi@gmail.com',   aptId: 'apt_002', sig: ResidentSignatureStatus.OBJECTING },
    { id: 'res_03', firstName: 'משה',  lastName: 'ברג',   phone: '0545551234', email: 'moshe.berg@walla.co.il',  aptId: 'apt_003', sig: ResidentSignatureStatus.INTERESTED },
    { id: 'res_04', firstName: 'שרה',  lastName: 'אברהם', phone: '0534449876', email: 'sara.avraham@gmail.com', aptId: 'apt_004', sig: ResidentSignatureStatus.UNDECIDED },
    { id: 'res_05', firstName: 'יוסי', lastName: 'מזרחי', phone: '0523334455', email: 'yossi.m@gmail.com',       aptId: 'apt_005', sig: ResidentSignatureStatus.SIGNED },
    { id: 'res_06', firstName: 'מירי', lastName: 'שפירא', phone: '0512223344', email: 'miri.s@gmail.com',        aptId: 'apt_006', sig: ResidentSignatureStatus.NOT_CONTACTED },
  ]

  for (const r of residentsData) {
    await prisma.resident.upsert({
      where:  { id: r.id },
      update: {},
      create: {
        id:              r.id,
        tenantId:        tenant.id,
        apartmentId:     r.aptId,
        firstName:       r.firstName,
        lastName:        r.lastName,
        phone:           r.phone,
        email:           r.email,
        signatureStatus: r.sig,
        portalEnabled:   r.sig === ResidentSignatureStatus.SIGNED,
      },
    })
  }
  console.log('✅ Residents seeded')

  // ── Owners + ownership registry ────────────────────────────────────────────
  // Owners drive the digital-signature flow (SignaturePackage → SignatureRecord),
  // so at least one owner must exist with a fractional holding in an apartment.
  const ownersData = [
    { id: 'own_01', fullName: 'דוד כהן',    phone: '0548018613', email: 'david.cohen@gmail.com',  residentId: 'res_01', aptId: 'apt_001', num: 1, den: 1 },
    { id: 'own_02', fullName: 'רחל לוי',    phone: '0529876543', email: 'rachel.levi@gmail.com',  residentId: 'res_02', aptId: 'apt_002', num: 1, den: 2 },
    { id: 'own_03', fullName: 'יוסי מזרחי', phone: '0523334455', email: 'yossi.m@gmail.com',      residentId: 'res_05', aptId: 'apt_005', num: 1, den: 1 },
  ]
  for (const o of ownersData) {
    await prisma.owner.upsert({
      where:  { id: o.id },
      update: {},
      create: {
        id:         o.id,
        tenantId:   tenant.id,
        fullName:   o.fullName,
        phone:      o.phone,
        email:      o.email,
        residentId: o.residentId,
      },
    })
    await prisma.ownerApartment.upsert({
      where:  { ownerId_apartmentId: { ownerId: o.id, apartmentId: o.aptId } },
      update: {},
      create: {
        ownerId:          o.id,
        apartmentId:      o.aptId,
        shareNumerator:   o.num,
        shareDenominator: o.den,
      },
    })
  }
  console.log('✅ Owners + ownership registry seeded')

  // ── Leads ──────────────────────────────────────────────────────────────────
  const leadsData = [
    { id: 'lead_01', firstName: 'אלון',  lastName: 'שרון',  phone: '0521111111', city: 'תל אביב',  status: LeadStatus.INTERESTED,        source: LeadSource.REFERRAL },
    { id: 'lead_02', firstName: 'נועה',  lastName: 'גלבוע', phone: '0522222222', city: 'רמת גן',   status: LeadStatus.MEETING_SCHEDULED,  source: LeadSource.WEBSITE },
    { id: 'lead_03', firstName: 'ניר',   lastName: 'פרידמן',phone: '0523333333', city: 'פתח תקווה',status: LeadStatus.NEW,                source: LeadSource.PHONE },
    { id: 'lead_04', firstName: 'תמי',   lastName: 'כץ',    phone: '0524444444', city: 'גבעתיים',  status: LeadStatus.NEGOTIATION,        source: LeadSource.WHATSAPP },
    { id: 'lead_05', firstName: 'גל',    lastName: 'מור',   phone: '0525555555', city: 'הרצליה',   status: LeadStatus.CONTACTED,          source: LeadSource.SOCIAL_MEDIA },
  ]
  for (const l of leadsData) {
    await prisma.lead.upsert({
      where:  { id: l.id },
      update: {},
      create: {
        ...l,
        tenantId:     tenant.id,
        assignedToId: pm.id,
      },
    })
  }
  console.log('✅ Leads seeded')

  // ── Signature Requests ─────────────────────────────────────────────────────
  await prisma.signatureRequest.upsert({
    where:  { id: 'sig_01' },
    update: {},
    create: {
      id:         'sig_01',
      tenantId:   tenant.id,
      residentId: 'res_01',
      status:     'SIGNED',
      provider:   'MANUAL',
      sentAt:     new Date('2024-03-01'),
      signedAt:   new Date('2024-03-05'),
    },
  })
  await prisma.signatureRequest.upsert({
    where:  { id: 'sig_02' },
    update: {},
    create: {
      id:         'sig_02',
      tenantId:   tenant.id,
      residentId: 'res_02',
      status:     'SENT',
      provider:   'MANUAL',
      sentAt:     new Date('2024-03-10'),
      expiresAt:  new Date('2024-04-10'),
    },
  })
  console.log('✅ Signature requests seeded')

  // ── Tasks ──────────────────────────────────────────────────────────────────
  await prisma.task.upsert({
    where:  { id: 'task_01' },
    update: {},
    create: {
      id:          'task_01',
      tenantId:    tenant.id,
      type:        'CALL',
      title:       'התקשר לרחל לוי — דיירת מתנגדת',
      status:      'PENDING',
      priority:    'HIGH',
      assigneeId:  pm.id,
      projectId:   project1.id,
      residentId:  'res_02',
      dueDate:     new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    },
  })
  await prisma.task.upsert({
    where:  { id: 'task_02' },
    update: {},
    create: {
      id:          'task_02',
      tenantId:    tenant.id,
      type:        'MEETING',
      title:       'ישיבת דיירים — ויצמן 12',
      status:      'PENDING',
      priority:    'MEDIUM',
      assigneeId:  pm.id,
      projectId:   project2.id,
      dueDate:     new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    },
  })
  await prisma.task.upsert({
    where:  { id: 'task_03' },
    update: {},
    create: {
      id:          'task_03',
      tenantId:    tenant.id,
      type:        'DOCUMENT_COLLECTION',
      title:       'איסוף ייפוי כוח נוטריוני',
      status:      'IN_PROGRESS',
      priority:    'URGENT',
      assigneeId:  admin.id,
      projectId:   project1.id,
      dueDate:     new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
    },
  })
  console.log('✅ Tasks seeded')

  // ── Audit log ──────────────────────────────────────────────────────────────
  const auditEntries = [
    { entity: 'Project',  action: 'CREATE' as const, entityId: project1.id, userId: admin.id },
    { entity: 'Resident', action: 'UPDATE' as const, entityId: 'res_01',    userId: pm.id    },
    { entity: 'SignatureRequest', action: 'SIGN' as const, entityId: 'sig_01', userId: admin.id },
  ]
  for (const entry of auditEntries) {
    await prisma.auditLog.create({
      data: {
        tenantId: tenant.id,
        userId:   entry.userId,
        action:   entry.action,
        entity:   entry.entity,
        entityId: entry.entityId,
      },
    })
  }
  console.log('✅ Audit logs seeded')

  console.log('\n✨ Seed complete! Login: admin@opendoor.co.il / demo1234')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
