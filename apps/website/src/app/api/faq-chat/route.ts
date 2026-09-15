import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { FAQ_SEED } from '@/mock/fixtures/faq'

/**
 * Server-side FAQ chat endpoint.
 *
 * The Anthropic API key never reaches the browser: the widget posts the
 * conversation here, this route calls Claude, and only the reply text goes
 * back. Runs on the Node runtime (not edge) because the Anthropic SDK needs
 * Node's `http`/`https` stack.
 *
 * Phase B (lead capture): once the model has collected a name, phone, and
 * building address through natural conversation, it calls the `submit_lead`
 * tool instead of writing them into a text reply. This route executes that
 * tool call itself — it never forwards tool input straight to the gateway
 * without validation, and never lets the model narrate an outcome it does
 * not know: the two possible replies below are fixed strings this route
 * chooses after the actual HTTP call succeeds or fails.
 */
export const runtime = 'nodejs'

const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 1000
const MAX_HISTORY_MESSAGES = 20
const LEAD_OFFER_THRESHOLD = 3

// Matches apps/website/src/lib/submission/index.ts's buildSubmissionMetadata,
// the source of truth for this value on the site's own forms. Duplicated
// here (not imported) because that module is a client-side entry point and
// this route intentionally stays a self-contained server file.
const PRIVACY_POLICY_VERSION = '2026-09-08'
const LEAD_SOURCE_PAGE = '/faq#chat'

const BASE_SYSTEM_PROMPT = `אתה עוזר מקצועי של קבוצת אופן דור יזמות והתחדשות בע"מ. אתה מומחה בהתחדשות עירונית ישראלית — פינוי-בינוי ותמ"א 38. ענה בעברית, בגובה העיניים, ובאופן ידידותי ומקצועי. אל תתן ייעוץ משפטי ספציפי — הפנה לעורך דין לשאלות משפטיות. אם שאלה לא קשורה להתחדשות עירונית, הסבר שאתה מתמחה בתחום זה בלבד.`

const LEAD_CAPTURE_INSTRUCTIONS = `
── איסוף ליד ──
החל מההודעה ה-${LEAD_OFFER_THRESHOLD} של המשתמש בשיחה (ורק פעם אחת — אל תחזור על ההצעה אם כבר הוצעה), הצע למשתמש: "רוצים שנבדוק את הבניין שלכם? אשמח לחבר אתכם לצוות שלנו." אם המשתמש מסרב, המשך לענות על שאלותיו כרגיל ואל תציע שוב.

אם המשתמש מסכים, בקש ממנו את הפרטים הבאים בזה אחר זה — שאלה אחת בכל הודעה, לא הכל יחד:
1. שם מלא
2. מספר טלפון
3. כתובת הבניין (רחוב, מספר ועיר אם ידוע)

ברגע שיש לך את שלושת הפרטים, קרא לכלי submit_lead עם הפרטים שנאספו. אל תמציא פרטים, ואל תקרא לכלי לפני שיש לך את כל השלושה. אל תכתוב בתשובת הטקסט שלך שהפרטים נשלחו — הודעת האישור נשלחת בנפרד לאחר שהשליחה בפועל הצליחה.`

/**
 * The system prompt is rebuilt from FAQ_SEED on every request rather than
 * cached as a module constant, so an edit to the fixture is live on the next
 * request with no redeploy of this route needed.
 */
function buildSystemPrompt(userMessageCount: number): string {
  const faqText = FAQ_SEED.map(
    (item, i) => `${i + 1}. ש: ${item.question.he}\n   ת: ${item.answer.he}`,
  ).join('\n\n')

  return `${BASE_SYSTEM_PROMPT}

להלן שאלות ותשובות נפוצות שכבר אושרו על ידי החברה. השתמש בהן כבסיס לתשובותיך כשהשאלה רלוונטית, ונסח אותן בקצרה ובשפה טבעית — אל תעתיק אותן מילה במילה:

${faqText}
${LEAD_CAPTURE_INSTRUCTIONS}

(מספר הודעות שהמשתמש כבר שלח בשיחה זו, כולל ההודעה הנוכחית: ${userMessageCount})`
}

const SUBMIT_LEAD_TOOL: Anthropic.Tool = {
  name: 'submit_lead',
  description:
    'שלח את פרטי הקשר של המשתמש לצוות, לאחר שהמשתמש הסכים להיות מחובר ' +
    'ומסר שם מלא, מספר טלפון וכתובת בניין. קרא לכלי הזה רק פעם אחת, ורק ' +
    'לאחר שיש לך את כל שלושת הפרטים.',
  input_schema: {
    type: 'object',
    properties: {
      fullName: { type: 'string', description: 'שם מלא של המשתמש' },
      phone: { type: 'string', description: 'מספר טלפון ישראלי' },
      address: { type: 'string', description: 'כתובת הבניין (רחוב, מספר, עיר)' },
    },
    required: ['fullName', 'phone', 'address'],
    additionalProperties: false,
  } as Anthropic.Tool.InputSchema,
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    (v.role === 'user' || v.role === 'assistant') &&
    typeof v.content === 'string' &&
    v.content.length > 0 &&
    v.content.length <= 4000
  )
}

interface LeadToolInput {
  fullName: string
  phone: string
  address: string
}

function isLeadToolInput(value: unknown): value is LeadToolInput {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.fullName === 'string' &&
    v.fullName.trim().length > 0 &&
    typeof v.phone === 'string' &&
    v.phone.trim().length > 0 &&
    typeof v.address === 'string' &&
    v.address.trim().length > 0
  )
}

/**
 * Submits the collected lead through the site's existing, already-hardened
 * public lead endpoint (`PublicLeadDto` / `PublicLeadsController`) rather
 * than adding a parallel path. Two consequences worth being explicit about:
 *
 *   - There is no `WEBSITE_CHAT` lead source: the DTO has no `source` field
 *     at all, and the service hardcodes `source: 'WEBSITE'` for every public
 *     submission regardless of what's sent. Distinguishing "came from the
 *     chat" is done in `message` (-> `notes` on the Lead row) instead of in
 *     `source`, so no schema/DTO change was needed to ship this.
 *   - `renderedAt` must be old enough to pass the endpoint's anti-spam
 *     "too fast" check (>= 3s before `submittedAt`); using the chat's own
 *     start time here means a real multi-turn conversation always clears it.
 */
async function submitLead(
  input: LeadToolInput,
  chatStartedAt: string,
): Promise<boolean> {
  const apiOrigin = process.env['NEXT_PUBLIC_API_URL']?.trim().replace(/\/+$/, '')
  if (!apiOrigin) {
    console.error('faq-chat: NEXT_PUBLIC_API_URL is not configured, cannot submit lead')
    return false
  }

  const now = new Date().toISOString()
  const renderedAt = Number.isNaN(Date.parse(chatStartedAt)) ? now : chatStartedAt

  const payload = {
    kind: 'CONTACT' as const,
    submissionId: crypto.randomUUID(),
    fullName: input.fullName.trim(),
    phone: input.phone.trim(),
    address: input.address.trim(),
    message: "ליד מצ'אט AI באתר",
    consentContact: true,
    consentPrivacy: true,
    privacyPolicyVersion: PRIVACY_POLICY_VERSION,
    sourcePage: LEAD_SOURCE_PAGE,
    locale: 'he' as const,
    submittedAt: now,
    renderedAt,
  }

  try {
    const response = await fetch(`${apiOrigin}/api/v1/public/leads`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return response.ok
  } catch (error) {
    console.error('faq-chat: lead submission request failed', error)
    return false
  }
}

export async function POST(request: Request) {
  const apiKey = process.env['ANTHROPIC_API_KEY']
  if (!apiKey) {
    return NextResponse.json({ error: 'unavailable' }, { status: 503 })
  }

  const body = (await request.json().catch(() => null)) as
    | { messages?: unknown; chatStartedAt?: unknown }
    | null
  const rawMessages = Array.isArray(body?.messages) ? body.messages : null
  if (!rawMessages || rawMessages.length === 0 || !rawMessages.every(isChatMessage)) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }
  const chatStartedAt =
    typeof body?.chatStartedAt === 'string' ? body.chatStartedAt : new Date().toISOString()

  const messages: ChatMessage[] = rawMessages.slice(-MAX_HISTORY_MESSAGES)
  const userMessageCount = messages.filter((m) => m.role === 'user').length

  const client = new Anthropic({ apiKey })

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: buildSystemPrompt(userMessageCount),
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      tools: [SUBMIT_LEAD_TOOL],
    })

    const toolUse = response.content.find((b) => b.type === 'tool_use')
    if (toolUse && toolUse.type === 'tool_use' && toolUse.name === 'submit_lead') {
      if (!isLeadToolInput(toolUse.input)) {
        return NextResponse.json({
          reply: 'לא הצלחנו לשמור את הפרטים, נסה דרך טופס צור קשר.',
        })
      }

      const ok = await submitLead(toolUse.input, chatStartedAt)
      return NextResponse.json({
        reply: ok
          ? 'תודה! הצוות שלנו יצור איתך קשר בקרוב.'
          : 'לא הצלחנו לשמור את הפרטים, נסה דרך טופס צור קשר.',
      })
    }

    const textBlock = response.content.find((b) => b.type === 'text')
    const reply = textBlock && textBlock.type === 'text' ? textBlock.text : ''
    if (!reply) {
      return NextResponse.json({ error: 'unavailable' }, { status: 503 })
    }

    return NextResponse.json({ reply })
  } catch (error) {
    // Logged as several plain-string lines, not one object, because a
    // terminal that folds/truncates a printed object (common on Windows
    // consoles, or when output is piped) can silently drop the one field
    // that explains the failure. Each line here stands on its own.
    console.error('faq-chat: Claude API request failed')
    console.error('faq-chat: error.name =', error instanceof Error ? error.name : typeof error)
    console.error('faq-chat: error.message =', error instanceof Error ? error.message : String(error))
    if (error instanceof Anthropic.APIError) {
      console.error('faq-chat: error.status =', error.status)
    }
    return NextResponse.json({ error: 'unavailable' }, { status: 503 })
  }
}
