import { createClient } from '@supabase/supabase-js'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Never throws — notification failures must not break sync/cron flows.
export async function sendTelegramMessage(chatId: number, text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return false
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function getLinkedChatId(userId: string): Promise<number | null> {
  const { data } = await serviceClient()
    .from('telegram_links')
    .select('chat_id')
    .eq('user_id', userId)
    .maybeSingle()
  return data?.chat_id ?? null
}

export type AccountChange = {
  customerId: string
  name: string | null
  field: 'status' | 'billing'
  from: string
  to: string
}

function formatCustomerId(id: string) {
  return id.length === 10 ? `${id.slice(0, 3)}-${id.slice(3, 6)}-${id.slice(6)}` : id
}

export function formatAccountChangesMessage(changes: AccountChange[]): string {
  const lines = ['⚠️ <b>Google Ads account changes</b>', '']
  for (const c of changes) {
    const name = c.name ? ` · ${escapeHtml(c.name)}` : ''
    lines.push(`<b>${formatCustomerId(c.customerId)}</b>${name}`)
    lines.push(`  ${c.field}: ${escapeHtml(c.from)} → ${escapeHtml(c.to)}`)
  }
  return lines.join('\n')
}

// Fire-and-forget: looks up the user's linked chat and sends the diff.
export async function notifyAccountChanges(userId: string, changes: AccountChange[]) {
  if (changes.length === 0) return
  const chatId = await getLinkedChatId(userId)
  if (!chatId) return
  await sendTelegramMessage(chatId, formatAccountChangesMessage(changes))
}
