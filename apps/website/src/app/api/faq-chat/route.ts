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
 */
export const runtime = 'nodejs'

const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 1000
const MAX_HISTORY_MESSAGES = 20

const BASE_SYSTEM_PROMPT = `אתה עוזר מקצועי של קבוצת אופן דור יזמות והתחדשות בע"מ. אתה מומחה בהתחדשות עירונית ישראלית — פינוי-בינוי ותמ"א 38. ענה בעברית, בגובה העיניים, ובאופן ידידותי ומקצועי. אל תתן ייעוץ משפטי ספציפי — הפנה לעורך דין לשאלות משפטיות. אם שאלה לא קשורה להתחדשות עירונית, הסבר שאתה מתמחה בתחום זה בלבד.`

/**
 * The system prompt is rebuilt from FAQ_SEED on every request rather than
 * cached as a module constant, so an edit to the fixture is live on the next
 * request with no redeploy of this route needed.
 */
function buildSystemPrompt(): string {
  const faqText = FAQ_SEED.map(
    (item, i) => `${i + 1}. ש: ${item.question.he}\n   ת: ${item.answer.he}`,
  ).join('\n\n')

  return `${BASE_SYSTEM_PROMPT}

להלן שאלות ותשובות נפוצות שכבר אושרו על ידי החברה. השתמש בהן כבסיס לתשובותיך כשהשאלה רלוונטית, ונסח אותן בקצרה ובשפה טבעית — אל תעתיק אותן מילה במילה:

${faqText}`
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

export async function POST(request: Request) {
  const apiKey = process.env['ANTHROPIC_API_KEY']
  if (!apiKey) {
    return NextResponse.json({ error: 'unavailable' }, { status: 503 })
  }

  const body = (await request.json().catch(() => null)) as { messages?: unknown } | null
  const rawMessages = Array.isArray(body?.messages) ? body.messages : null
  if (!rawMessages || rawMessages.length === 0 || !rawMessages.every(isChatMessage)) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  const messages: ChatMessage[] = rawMessages.slice(-MAX_HISTORY_MESSAGES)

  const client = new Anthropic({ apiKey })

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: buildSystemPrompt(),
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    const reply = textBlock && textBlock.type === 'text' ? textBlock.text : ''
    if (!reply) {
      return NextResponse.json({ error: 'unavailable' }, { status: 503 })
    }

    return NextResponse.json({ reply })
  } catch (error) {
    console.error('faq-chat: Claude API request failed', error)
    return NextResponse.json({ error: 'unavailable' }, { status: 503 })
  }
}
