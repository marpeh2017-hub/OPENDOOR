import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import Anthropic from '@anthropic-ai/sdk'
import { PrismaService } from '../prisma.service'
import type { PortalScope } from './portal-scope.service'
import type { ChatMessageDto } from './dto/portal-chat.dto'

const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 1000
const MESSAGE_HISTORY_FOR_PROMPT = 5
const DOCUMENT_HISTORY_FOR_PROMPT = 5

const BASE_INSTRUCTIONS = `ענה בעברית, בגובה העיניים, ובאופן ידידותי ומקצועי.
אל תמציא מידע שאין לך — אם אינך יודע משהו, אמור זאת בפירוש במקום לנחש.
אל תתן ייעוץ משפטי ספציפי — הפנה לעורך דין לשאלות משפטיות.
אם הדייר שואל על מועדים או תמורות ספציפיים לדירה שלו — אלה נקבעים לכל פרויקט בנפרד, הפנה אותו לצוות הפרויקט (איש הקשר בהמשך ההנחיות) ואל תנחש מספרים או תאריכים.`

/**
 * Assembles the AI assistant's one-time context and calls Claude.
 *
 * ── WHY THIS IS A FRESH SET OF QUERIES AND NOT `PortalDashboardService` ─────
 *
 * The dashboard's queries are private methods returning UI-shaped objects
 * (labels, progress percentages, a curated document list). The prompt needs
 * plain facts instead — reusing those methods would mean either exposing
 * them as public API for one caller, or re-shaping their output back into
 * prose. Both are more coupling than four short, self-contained queries.
 *
 * ── THE SAME SCOPING RULE AS EVERY OTHER PORTAL ENDPOINT ─────────────────────
 *
 * Every query below is filtered by `PortalScope`, which the controller
 * derived from the authenticated session before this service ever runs. No
 * id here comes from the request body — `PortalChatDto` carries only the
 * conversation text.
 */
@Injectable()
export class PortalChatService {
  private readonly logger = new Logger(PortalChatService.name)

  constructor(private readonly prisma: PrismaService) {}

  async reply(scope: PortalScope, messages: ChatMessageDto[]): Promise<string> {
    const apiKey = process.env['ANTHROPIC_API_KEY']
    if (!apiKey) {
      throw new ServiceUnavailableException('הצ׳אט אינו זמין כרגע')
    }

    const system = await this.buildSystemPrompt(scope)

    const workspaceId = process.env['ANTHROPIC_WORKSPACE_ID']
    const client = new Anthropic({
      apiKey,
      ...(workspaceId ? { defaultHeaders: { 'anthropic-workspace-id': workspaceId } } : {}),
    })

    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      })

      const textBlock = response.content.find((b) => b.type === 'text')
      const reply = textBlock && textBlock.type === 'text' ? textBlock.text : ''
      if (!reply) throw new Error('empty response')
      return reply
    } catch (error) {
      this.logger.error('Claude API request failed')
      this.logger.error(`error.name = ${error instanceof Error ? error.name : typeof error}`)
      this.logger.error(
        `error.message = ${error instanceof Error ? error.message : String(error)}`,
      )
      throw new ServiceUnavailableException('הצ׳אט אינו זמין כרגע, נסה שוב מאוחר יותר')
    }
  }

  private async buildSystemPrompt(scope: PortalScope): Promise<string> {
    const [project, resident, messages, documents, manager] = await Promise.all([
      this.project(scope),
      this.resident(scope),
      this.recentMessages(scope),
      this.documents(scope),
      this.projectManager(scope),
    ])

    const messagesText = messages.length
      ? messages.map((m) => `- (${formatDate(m.createdAt)}) ${m.subject ?? firstLine(m.body)}`).join('\n')
      : '(לא נשלחו הודעות עד כה)'

    const documentsText = documents.length
      ? documents.map((d) => `- ${d.title} (${d.category})`).join('\n')
      : '(לא הוקצו מסמכים)'

    const contactLine = manager
      ? `איש הקשר בצוות הפרויקט: ${manager.name}${manager.email ? ` (${manager.email})` : ''}.`
      : 'אין איש קשר רשום כרגע לפרויקט — הפנה את הדייר לתמיכה דרך עמוד התמיכה בפורטל.'

    return `אתה עוזר AI בפורטל הדיירים של קבוצת אופן דור יזמות והתחדשות בע"מ. אתה מדבר עם דייר ספציפי שמחובר לפורטל, ואתה מכיר את הפרטים שלו בלבד — לא של דיירים אחרים.

── פרטי הדייר ──
שם: ${scope.residentName}
דירה: מספר ${scope.apartmentNumber}, ${scope.buildingAddress}
סטטוס חתימה: ${SIGNATURE_STATUS_LABELS[resident.signatureStatus] ?? resident.signatureStatus}${resident.isObjecting ? ' (מתנגד/ת)' : ''}

── הפרויקט ──
שם הפרויקט: ${project.name}
שלב נוכחי: ${STAGE_LABELS[project.stage] ?? project.stage}
יחידות בפרויקט: ${project.totalUnits} סה"כ, ${project.signedUnits} חתמו עד כה
${contactLine}

── ההודעות האחרונות שנשלחו לדייר (${messages.length} אחרונות) ──
${messagesText}

── מסמכים שהוקצו לדייר ──
${documentsText}

── הנחיות ──
${BASE_INSTRUCTIONS}`
  }

  private async project(scope: PortalScope) {
    return this.prisma.project.findFirstOrThrow({
      where: { id: scope.projectId, tenantId: scope.tenantId },
      select: { name: true, stage: true, totalUnits: true, signedUnits: true },
    })
  }

  private async resident(scope: PortalScope) {
    return this.prisma.resident.findFirstOrThrow({
      where: { id: scope.residentId },
      select: { signatureStatus: true, isObjecting: true },
    })
  }

  private async recentMessages(scope: PortalScope) {
    return this.prisma.message.findMany({
      where: {
        residentId: scope.residentId,
        tenantId: scope.tenantId,
        direction: 'OUTBOUND',
        status: { in: ['SENT', 'DELIVERED', 'READ'] },
      },
      select: { subject: true, body: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: MESSAGE_HISTORY_FOR_PROMPT,
    })
  }

  private async documents(scope: PortalScope) {
    const rows = await this.prisma.residentDocument.findMany({
      where: {
        residentId: scope.residentId,
        document: { tenantId: scope.tenantId, isLatest: true },
      },
      select: { document: { select: { title: true, category: true } } },
      orderBy: { addedAt: 'desc' },
      take: DOCUMENT_HISTORY_FOR_PROMPT,
    })
    return rows.map((r) => r.document)
  }

  /** Same tenant-scoped lookup as the dashboard — see that file for why it's two queries. */
  private async projectManager(scope: PortalScope) {
    const project = await this.prisma.project.findFirstOrThrow({
      where: { id: scope.projectId, tenantId: scope.tenantId },
      select: { projectManagerId: true },
    })
    if (!project.projectManagerId) return null

    const pm = await this.prisma.user.findFirst({
      where: { id: project.projectManagerId, tenantId: scope.tenantId, isActive: true },
      select: { firstName: true, lastName: true, email: true },
    })
    if (!pm) return null

    return { name: `${pm.firstName} ${pm.lastName}`.trim(), email: pm.email }
  }
}

const STAGE_LABELS: Record<string, string> = {
  DISCOVERY: 'איתור',
  FEASIBILITY: 'בדיקת היתכנות',
  RESIDENT_ORGANIZATION: 'התארגנות דיירים',
  SIGNATURES: 'חתימות',
  DEVELOPER_SELECTION: 'בחירת יזם',
  PLANNING: 'תכנון',
  MUNICIPAL_APPROVAL: 'אישור עירייה',
  PERMIT: 'היתר בנייה',
  EVACUATION: 'פינוי',
  CONSTRUCTION: 'בנייה',
  DELIVERY: 'מסירה',
  POST_DELIVERY: 'אחרי מסירה',
}

const SIGNATURE_STATUS_LABELS: Record<string, string> = {
  NOT_CONTACTED: 'טרם נוצר קשר',
  CONTACTED: 'נוצר קשר',
  INTERESTED: 'מביע עניין',
  SIGNED: 'חתם/ה',
  OBJECTING: 'מתנגד/ת',
  UNDECIDED: 'טרם החליט/ה',
  UNREACHABLE: 'לא ניתן ליצור קשר',
}

function firstLine(body: string, max = 80): string {
  const line = body.split('\n').map((l) => l.trim()).find(Boolean) ?? ''
  return line.length > max ? `${line.slice(0, max - 1)}…` : line
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('he-IL')
}
