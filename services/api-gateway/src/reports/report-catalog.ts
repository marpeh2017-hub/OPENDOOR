import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { FormsService } from '../forms/forms.service'
import { DomainError } from '../common/errors/domain-error'

/**
 * The reports the CRM can produce: what each one lists, who may run it, the
 * filters it takes and the columns it can show. The CRM's report generator
 * draws its screens from this (GET /reports/types), and the export buttons on
 * the owners, leads and form screens run the same reports with the filters
 * already chosen there, so a list and its export never disagree.
 *
 * ── WHAT NEVER LEAVES ─────────────────────────────────────────────────────
 *
 * National ID numbers. The owners report says whether the file has one
 * ("ת״ז בתיק"), and the signatures report whether a signer typed a different
 * one; the number itself is in neither. Phones and emails are in, as on the
 * screens they come from, which is why each report is limited to the roles
 * that work with those people, and every export is audited.
 */

export type FilterKind = 'project' | 'complex' | 'building' | 'form' | 'select' | 'date' | 'text' | 'boolean'

export interface ReportFilterSpec {
  key: string
  label: string
  kind: FilterKind
  options?: { value: string; label: string }[]
  required?: boolean
}

export interface ReportColumnSpec {
  key: string
  label: string
  /** Excel column width, in characters. */
  width: number
  /** Shown unless the user unticks it. */
  default: boolean
}

export interface ReportDefinition {
  type: ReportType
  label: string
  description: string
  roles: readonly string[]
  filters: ReportFilterSpec[]
  columns: ReportColumnSpec[]
  /** ASCII stem of the downloaded file's name. */
  fileStem: string
}

export type Cell = string | number | null
export type Filters = Record<string, string | boolean | undefined>
export interface ReportRows {
  rows: Record<string, Cell>[]
  /** Label and value lines for the report's details sheet (totals, majority). */
  summary: [string, string][]
}

export const REPORT_TYPES = ['owners', 'leads', 'form-signatures', 'projects'] as const
export type ReportType = (typeof REPORT_TYPES)[number]

/* ─── Labels, as the CRM shows them ─────────────────────────────────────── */

export const LEAD_STATUS_LABELS: Record<string, string> = {
  NEW: 'ליד חדש', CONTACTED: 'נוצר קשר', MEETING_SCHEDULED: 'נקבעה פגישה', INTERESTED: 'מתעניין',
  NEGOTIATION: 'משא ומתן', SIGNED: 'נחתם', LOST: 'אבד',
}
export const LEAD_SOURCE_LABELS: Record<string, string> = {
  WEBSITE: 'אתר', REFERRAL: 'הפניה', WHATSAPP: 'וואטסאפ', PHONE: 'טלפון', SOCIAL_MEDIA: 'רשתות חברתיות',
  CAMPAIGN: 'קמפיין', DOOR_TO_DOOR: 'דלת לדלת', EVENT: 'אירוע', PARTNER: 'שותף', OTHER: 'אחר',
}
export const STAGE_LABELS: Record<string, string> = {
  DISCOVERY: 'גילוי', FEASIBILITY: 'היתכנות', RESIDENT_ORGANIZATION: 'התארגנות', SIGNATURES: 'חתימות',
  DEVELOPER_SELECTION: 'בחירת יזם', PLANNING: 'תכנון', MUNICIPAL_APPROVAL: 'אישור עירוני', PERMIT: 'היתר',
  EVACUATION: 'פינוי', CONSTRUCTION: 'בנייה', DELIVERY: 'מסירה', POST_DELIVERY: 'לאחר מסירה',
}
const FORM_TYPE_LABELS: Record<string, string> = {
  REPRESENTATION_PROTOCOL: 'פרוטוקול מינוי נציגות',
  ORGANIZING_AGREEMENT: 'הסכם לארגון וליווי',
  ASSEMBLY_NOTICE: 'הודעה על כינוס בעלי דירות',
}
const RECORD_STATUS_LABELS: Record<string, string> = {
  PENDING: 'ממתין', SIGNED: 'חתם', REFUSED: 'סירב', REVOKED: 'בוטל',
}
const DELIVERY_LABELS: Record<string, string> = {
  SMS: 'SMS', EMAIL: 'אימייל', WHATSAPP: 'ווטסאפ', UNSENT: 'ממתין לשליחה בווטסאפ',
  NONE: 'אין טלפון ואימייל', FAILED: 'השליחה נכשלה',
}

const options = (labels: Record<string, string>) =>
  Object.entries(labels).map(([value, label]) => ({ value, label }))

const yesNo = (value: boolean) => (value ? 'כן' : 'לא')

/** dd.mm.yyyy in Israel time, as dates print everywhere else. */
export function israelDate(value: Date | string | null | undefined): string {
  if (!value) return ''
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', year: 'numeric' })
    .format(date).replace(/\//g, '.')
}

const percent = (share: number | null | undefined) =>
  share === null || share === undefined ? '' : `${Math.round(share * 1000) / 10}%`

const byText = (a: string, b: string) => a.localeCompare(b, 'he', { numeric: true })

/* ─── The catalogue ─────────────────────────────────────────────────────── */

const MANAGERS = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER'] as const

export const REPORTS: Record<ReportType, ReportDefinition> = {
  owners: {
    type: 'owners',
    label: 'בעלי דירות',
    description: 'כל בעל דירה בכל דירה שבבעלותו, עם פרטי הקשר וחלקו בדירה.',
    roles: [...MANAGERS, 'RESIDENT_RELATIONS_MANAGER'],
    fileStem: 'owners',
    filters: [
      { key: 'projectId', label: 'פרויקט', kind: 'project' },
      { key: 'complexId', label: 'מתחם', kind: 'complex' },
      { key: 'buildingId', label: 'בניין', kind: 'building' },
      { key: 'search', label: 'חיפוש לפי שם, טלפון או אימייל', kind: 'text' },
      {
        key: 'missing', label: 'חסר בתיק', kind: 'select',
        options: [{ value: 'phone', label: 'טלפון' }, { value: 'email', label: 'אימייל' }, { value: 'nationalId', label: 'תעודת זהות' }],
      },
      // The owners screen's own two filters, with its values, so its export matches it.
      {
        key: 'status', label: 'סטטוס', kind: 'select',
        options: [{ value: 'ACTIVE', label: 'פעילים' }, { value: 'INACTIVE', label: 'לא פעילים' }],
      },
      {
        key: 'estate', label: 'עיזבונות', kind: 'select',
        options: [{ value: 'ESTATE', label: 'עיזבונות בלבד' }, { value: 'REGULAR', label: 'ללא עיזבונות' }],
      },
    ],
    columns: [
      { key: 'fullName', label: 'שם', width: 26, default: true },
      { key: 'phone', label: 'טלפון', width: 14, default: true },
      { key: 'email', label: 'אימייל', width: 26, default: true },
      { key: 'project', label: 'פרויקט', width: 20, default: true },
      { key: 'complex', label: 'מתחם', width: 22, default: false },
      { key: 'building', label: 'בניין', width: 22, default: true },
      { key: 'apartment', label: 'דירה', width: 8, default: true },
      { key: 'floor', label: 'קומה', width: 8, default: false },
      { key: 'share', label: 'חלק בדירה', width: 11, default: true },
      { key: 'hasNationalId', label: 'ת״ז בתיק', width: 10, default: true },
      { key: 'isEstate', label: 'עיזבון', width: 9, default: false },
      { key: 'isActive', label: 'פעיל', width: 8, default: false },
      { key: 'notes', label: 'הערות', width: 40, default: false },
    ],
  },
  leads: {
    type: 'leads',
    label: 'לידים',
    description: 'פניות שהגיעו מהאתר ומכל מקור אחר, עם המצב והמקור שלהן.',
    roles: [...MANAGERS, 'RESIDENT_RELATIONS_MANAGER', 'FIELD_AGENT'],
    fileStem: 'leads',
    filters: [
      { key: 'status', label: 'מצב', kind: 'select', options: options(LEAD_STATUS_LABELS) },
      { key: 'source', label: 'מקור', kind: 'select', options: options(LEAD_SOURCE_LABELS) },
      { key: 'from', label: 'מתאריך', kind: 'date' },
      { key: 'to', label: 'עד תאריך', kind: 'date' },
      { key: 'search', label: 'חיפוש לפי שם, טלפון, אימייל או כתובת', kind: 'text' },
    ],
    columns: [
      { key: 'name', label: 'שם', width: 24, default: true },
      { key: 'phone', label: 'טלפון', width: 14, default: true },
      { key: 'email', label: 'אימייל', width: 26, default: true },
      { key: 'status', label: 'מצב', width: 14, default: true },
      { key: 'source', label: 'מקור', width: 14, default: true },
      { key: 'city', label: 'עיר', width: 14, default: true },
      { key: 'address', label: 'כתובת', width: 26, default: true },
      { key: 'units', label: 'מספר דירות', width: 11, default: false },
      { key: 'createdAt', label: 'נוצר', width: 12, default: true },
      { key: 'consent', label: 'הסכים ליצירת קשר', width: 15, default: false },
      { key: 'campaign', label: 'קמפיין', width: 18, default: false },
      { key: 'notes', label: 'הערות', width: 40, default: false },
    ],
  },
  'form-signatures': {
    type: 'form-signatures',
    label: 'מצב החתימות בטופס',
    description: 'מי חתם ומי לא, לכל דירה, עם החלק בבעלות ורוב החתימות שהושג.',
    roles: [...MANAGERS, 'LAWYER', 'RESIDENT_RELATIONS_MANAGER'],
    fileStem: 'form-signatures',
    filters: [{ key: 'packageId', label: 'טופס', kind: 'form', required: true }],
    columns: [
      { key: 'building', label: 'בניין', width: 22, default: true },
      { key: 'apartment', label: 'דירה', width: 8, default: true },
      { key: 'ownerName', label: 'בעל הדירה', width: 26, default: true },
      { key: 'share', label: 'חלק בדירה', width: 11, default: true },
      { key: 'status', label: 'מצב', width: 12, default: true },
      { key: 'signedAt', label: 'תאריך חתימה', width: 13, default: true },
      { key: 'method', label: 'אופן החתימה', width: 13, default: true },
      { key: 'deliveredVia', label: 'נשלח ב־', width: 18, default: true },
      { key: 'representative', label: 'נציג', width: 8, default: true },
      { key: 'phone', label: 'טלפון', width: 14, default: true },
      { key: 'email', label: 'אימייל', width: 26, default: false },
      { key: 'idMismatch', label: 'ת״ז שונה מהתיק', width: 15, default: false },
    ],
  },
  projects: {
    type: 'projects',
    label: 'פרויקטים',
    description: 'כל פרויקט עם השלב שלו, מספר הבניינים, הדירות ובעלי הדירות.',
    roles: [...MANAGERS, 'RESIDENT_RELATIONS_MANAGER', 'FIELD_AGENT', 'LAWYER'],
    fileStem: 'projects',
    filters: [{ key: 'stage', label: 'שלב', kind: 'select', options: options(STAGE_LABELS) }],
    columns: [
      { key: 'name', label: 'פרויקט', width: 24, default: true },
      { key: 'code', label: 'קוד', width: 12, default: false },
      { key: 'city', label: 'עיר', width: 14, default: true },
      { key: 'stage', label: 'שלב', width: 14, default: true },
      { key: 'complexes', label: 'מתחמים', width: 9, default: true },
      { key: 'buildings', label: 'בניינים', width: 9, default: true },
      { key: 'apartments', label: 'דירות', width: 9, default: true },
      { key: 'owners', label: 'בעלי דירות', width: 11, default: true },
      { key: 'createdAt', label: 'נפתח', width: 12, default: false },
    ],
  },
}

/** Builds the rows of each report, inside one tenant. */
@Injectable()
export class ReportCatalog {
  constructor(
    private readonly prisma: PrismaService,
    private readonly forms: FormsService,
  ) {}

  rows(type: ReportType, filters: Filters, tenantId: string): Promise<ReportRows> {
    switch (type) {
      case 'owners': return this.owners(filters, tenantId)
      case 'leads': return this.leads(filters, tenantId)
      case 'form-signatures': return this.formSignatures(filters, tenantId)
      case 'projects': return this.projects(filters, tenantId)
    }
  }

  private async owners(f: Filters, tenantId: string): Promise<ReportRows> {
    const str = (key: string) => (typeof f[key] === 'string' && f[key] ? String(f[key]) : undefined)
    const projectId = str('projectId'), complexId = str('complexId'), buildingId = str('buildingId')
    const search = str('search'), missing = str('missing'), status = str('status'), estate = str('estate')
    const conditions: object[] = []
    if (search) {
      conditions.push({ OR: [
        { fullName: { contains: search, mode: 'insensitive' as const } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' as const } },
      ] })
    }
    if (missing === 'phone' || missing === 'email' || missing === 'nationalId') {
      conditions.push({ OR: [{ [missing]: null }, { [missing]: '' }] })
    }
    const where = {
      tenantId,
      ...(status === 'ACTIVE' ? { isActive: true } : status === 'INACTIVE' ? { isActive: false } : {}),
      ...(estate === 'ESTATE' ? { isEstate: true } : estate === 'REGULAR' ? { isEstate: false } : {}),
      ...(conditions.length ? { AND: conditions } : {}),
    }

    const located = Boolean(projectId || complexId || buildingId)
    const holdings = await this.prisma.ownerApartment.findMany({
      where: {
        owner: where as never,
        apartment: {
          building: {
            ...(buildingId ? { id: buildingId } : {}),
            complex: { ...(complexId ? { id: complexId } : {}), ...(projectId ? { projectId } : {}), project: { tenantId } },
          },
        },
      },
      select: {
        shareNumerator: true, shareDenominator: true,
        owner: { select: { fullName: true, phone: true, email: true, nationalId: true, isEstate: true, isActive: true, notes: true } },
        apartment: {
          select: {
            apartmentNumber: true, floor: true,
            building: { select: { address: true, streetNumber: true, complex: { select: { name: true, project: { select: { name: true } } } } } },
          },
        },
      },
    })
    // Owners on file with no apartment yet: only when no place was asked for.
    const unplaced = located ? [] : await this.prisma.owner.findMany({
      where: { ...(where as object), holdings: { none: {} } } as never,
      select: { fullName: true, phone: true, email: true, nationalId: true, isEstate: true, isActive: true, notes: true },
    })

    type OwnerRow = { fullName: string; phone: string | null; email: string | null; nationalId: string | null; isEstate: boolean; isActive: boolean; notes: string | null }
    const person = (o: OwnerRow) => ({
      fullName: o.fullName, phone: o.phone ?? '', email: o.email ?? '',
      hasNationalId: yesNo(Boolean(o.nationalId)), isEstate: yesNo(o.isEstate), isActive: yesNo(o.isActive), notes: o.notes ?? '',
    })
    const rows: Record<string, Cell>[] = [
      ...holdings.map((h) => ({
        ...person(h.owner),
        project: h.apartment.building.complex.project.name,
        complex: h.apartment.building.complex.name,
        building: [h.apartment.building.address, h.apartment.building.streetNumber].filter(Boolean).join(' '),
        apartment: h.apartment.apartmentNumber,
        floor: h.apartment.floor ?? '',
        share: h.shareDenominator > 1 ? `${h.shareNumerator}/${h.shareDenominator}` : 'מלא',
      })),
      ...unplaced.map((o) => ({ ...person(o), project: '', complex: '', building: '', apartment: '', floor: '', share: '' })),
    ]
    rows.sort((a, b) =>
      byText(String(a.project), String(b.project)) || byText(String(a.building), String(b.building)) ||
      byText(String(a.apartment), String(b.apartment)) || byText(String(a.fullName), String(b.fullName)))
    const people = new Set(rows.map((r) => `${r.fullName}|${r.phone}|${r.email}`)).size
    return { rows, summary: [['שורות (בעל דירה בדירה)', String(rows.length)], ['אנשים', String(people)]] }
  }

  private async leads(f: Filters, tenantId: string): Promise<ReportRows> {
    const str = (key: string) => (typeof f[key] === 'string' && f[key] ? String(f[key]) : undefined)
    const status = str('status'), source = str('source'), from = str('from'), to = str('to'), search = str('search')
    const leads = await this.prisma.lead.findMany({
      where: {
        tenantId,
        ...(status ? { status: status as never } : {}),
        ...(source ? { source: source as never } : {}),
        ...(from || to
          ? { createdAt: {
              ...(from ? { gte: new Date(`${from}T00:00:00+03:00`) } : {}),
              ...(to ? { lte: new Date(`${to}T23:59:59.999+03:00`) } : {}),
            } }
          : {}),
        ...(search
          ? { OR: [
              { firstName: { contains: search, mode: 'insensitive' as const } },
              { lastName: { contains: search, mode: 'insensitive' as const } },
              { phone: { contains: search } },
              { email: { contains: search, mode: 'insensitive' as const } },
              { address: { contains: search, mode: 'insensitive' as const } },
            ] }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
      select: {
        firstName: true, lastName: true, phone: true, email: true, status: true, source: true, city: true, address: true,
        estimatedUnits: true, createdAt: true, consentContact: true, utmCampaign: true, utmSource: true, notes: true,
      },
    })
    const rows = leads.map((l) => ({
      name: `${l.firstName} ${l.lastName}`.trim(),
      phone: l.phone ?? '', email: l.email ?? '',
      status: LEAD_STATUS_LABELS[l.status] ?? l.status,
      source: LEAD_SOURCE_LABELS[l.source] ?? l.source,
      city: l.city ?? '', address: l.address ?? '',
      units: l.estimatedUnits ?? '',
      createdAt: israelDate(l.createdAt),
      consent: yesNo(l.consentContact),
      campaign: l.utmCampaign ?? l.utmSource ?? '',
      notes: l.notes ?? '',
    }))
    return { rows, summary: [['לידים', String(rows.length)]] }
  }

  private async formSignatures(f: Filters, tenantId: string): Promise<ReportRows> {
    const packageId = typeof f.packageId === 'string' ? f.packageId : ''
    if (!packageId) throw DomainError.validation('REPORT_FORM_REQUIRED', 'צריך לבחור טופס')
    const form = await this.forms.get(packageId, tenantId)
    if (form.status === 'DRAFT') throw DomainError.validation('REPORT_FORM_DRAFT', 'הטופס עוד לא נשלח')
    const notice = form.formType === 'ASSEMBLY_NOTICE'
    const rows = form.records.map((r) => ({
      building: r.buildingAddress,
      apartment: r.apartmentNumber,
      ownerName: r.ownerName,
      share: percent(r.share),
      status: notice
        ? (r.openedAt ? 'פתח' : 'לא פתח')
        : r.status === 'SIGNED' && r.method === 'WET' ? 'חתם על נייר' : RECORD_STATUS_LABELS[r.status] ?? r.status,
      signedAt: israelDate(notice ? r.openedAt : r.signedAt),
      method: r.status !== 'SIGNED' ? '' : r.method === 'WET' ? 'על נייר' : 'בקישור',
      deliveredVia: r.deliveredVia ? DELIVERY_LABELS[r.deliveredVia] ?? r.deliveredVia : 'לא נשלח',
      representative: yesNo(r.isRepresentative),
      phone: r.phone ?? '',
      email: r.email ?? '',
      idMismatch: r.idMismatch ? 'כן' : '',
    }))
    const p = form.progress
    const summary: [string, string][] = [
      ['טופס', form.title],
      ['סוג', FORM_TYPE_LABELS[form.formType ?? ''] ?? ''],
      ['פרויקט', form.project?.name ?? ''],
      ['נשלח', israelDate(form.sentAt)],
      ...(notice
        ? [['פתחו את ההודעה', `${p.ownersOpened} מתוך ${p.owners} שורות`] as [string, string]]
        : [
            ['חתמו', `${p.ownersSigned} מתוך ${p.owners} שורות (בעל דירה בדירה)`] as [string, string],
            ['דירות שכל בעליהן חתמו', `${p.apartmentsSigned} מתוך ${p.apartments}`] as [string, string],
            ['החלק בבעלות שחתם', `${p.sharePercent}%`] as [string, string],
          ]),
    ]
    return { rows, summary }
  }

  private async projects(f: Filters, tenantId: string): Promise<ReportRows> {
    const stage = typeof f.stage === 'string' && f.stage ? f.stage : undefined
    const projects = await this.prisma.project.findMany({
      where: { tenantId, ...(stage ? { stage: stage as never } : {}) },
      orderBy: { name: 'asc' },
      select: {
        id: true, name: true, code: true, city: true, stage: true, createdAt: true,
        complexes: { select: { buildings: { select: { _count: { select: { apartments: true } } } } } },
      },
    })
    const holdings = await this.prisma.ownerApartment.findMany({
      where: { owner: { tenantId, isActive: true }, apartment: { building: { complex: { projectId: { in: projects.map((p) => p.id) } } } } },
      select: { ownerId: true, apartment: { select: { building: { select: { complex: { select: { projectId: true } } } } } } },
    })
    const owners = new Map<string, Set<string>>()
    for (const h of holdings) {
      const id = h.apartment.building.complex.projectId
      owners.set(id, (owners.get(id) ?? new Set()).add(h.ownerId))
    }
    const rows = projects.map((p) => {
      const buildings = p.complexes.flatMap((c) => c.buildings)
      return {
        name: p.name, code: p.code, city: p.city,
        stage: STAGE_LABELS[p.stage] ?? p.stage,
        complexes: p.complexes.length,
        buildings: buildings.length,
        apartments: buildings.reduce((sum, b) => sum + b._count.apartments, 0),
        owners: owners.get(p.id)?.size ?? 0,
        createdAt: israelDate(p.createdAt),
      }
    })
    return { rows, summary: [['פרויקטים', String(rows.length)]] }
  }
}
