import { createClient } from '@supabase/supabase-js'
import { getLinkedChatId, sendTelegramMessage, escapeHtml } from './telegram'
import { getUntrackedCustomerIds } from './google-ads-accounts'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

type Comparator = 'gt' | 'gte' | 'lt' | 'lte'

type Rule = {
  id: number
  metric: 'roas' | 'spend'
  period: 'day' | 'week' | 'month'
  comparator: Comparator | null
  threshold: number | null
  customer_id: string | null
  enabled: boolean
  last_sent_at: string | null
}

const COMPARATOR_LABEL: Record<Comparator, string> = {
  gt: '>', gte: '≥', lt: '<', lte: '≤',
}

const PERIOD_LABEL = { day: 'Daily', week: 'Weekly', month: 'Monthly' }

function utcDateStr(d: Date) {
  return d.toISOString().slice(0, 10)
}

function addDays(d: Date, days: number) {
  const r = new Date(d)
  r.setUTCDate(r.getUTCDate() + days)
  return r
}

// Reporting window per period, relative to `now` (UTC). Daily reports cover
// yesterday; weekly fire on Monday for the previous Mon–Sun; monthly fire on
// the 1st for the previous calendar month. Returns null when not due today.
function ruleWindow(period: Rule['period'], now: Date): { from: string; to: string } | null {
  const yesterday = addDays(now, -1)
  if (period === 'day') {
    return { from: utcDateStr(yesterday), to: utcDateStr(yesterday) }
  }
  if (period === 'week') {
    if (now.getUTCDay() !== 1) return null
    return { from: utcDateStr(addDays(now, -7)), to: utcDateStr(yesterday) }
  }
  if (now.getUTCDate() !== 1) return null
  const first = new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), 1))
  return { from: utcDateStr(first), to: utcDateStr(yesterday) }
}

function matches(value: number, comparator: Comparator, threshold: number): boolean {
  switch (comparator) {
    case 'gt': return value > threshold
    case 'gte': return value >= threshold
    case 'lt': return value < threshold
    case 'lte': return value <= threshold
  }
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Evaluates every enabled rule for the user against campaign_snapshots and
// sends a Telegram message per rule that is due and matches its condition.
// Accounts can differ in currency, so totals are grouped per currency and a
// conditional rule fires if any currency group matches.
export async function evaluateUserNotificationRules(
  userId: string,
  now: Date = new Date()
): Promise<{ sent: number; errors: string[] }> {
  const errors: string[] = []
  const chatId = await getLinkedChatId(userId)
  if (!chatId) return { sent: 0, errors }

  const supabase = serviceClient()
  const { data: rules, error } = await supabase
    .from('notification_rules')
    .select('*')
    .eq('user_id', userId)
    .eq('enabled', true)
  if (error) return { sent: 0, errors: [`rules: ${error.message}`] }
  if (!rules || rules.length === 0) return { sent: 0, errors }

  const untracked = await getUntrackedCustomerIds(userId)
  const today = utcDateStr(now)
  let sent = 0

  for (const rule of rules as Rule[]) {
    const window = ruleWindow(rule.period, now)
    if (!window) continue
    // Already handled this period (cron re-run / manual trigger on same day)
    if (rule.last_sent_at && utcDateStr(new Date(rule.last_sent_at)) === today) continue

    let query = supabase
      .from('campaign_snapshots')
      .select('customer_id, account_name, currency, spend, conversions_value')
      .eq('user_id', userId)
      .gte('snapshot_date', window.from)
      .lte('snapshot_date', window.to)
    if (rule.customer_id) query = query.eq('customer_id', rule.customer_id)

    const { data: rows, error: qError } = await query
    if (qError) {
      errors.push(`rule ${rule.id}: ${qError.message}`)
      continue
    }

    // Sum spend / conversion value per currency
    const groups = new Map<string, { spend: number; value: number; accountName: string | null }>()
    for (const r of rows ?? []) {
      if (!rule.customer_id && untracked.has(r.customer_id)) continue
      const key = r.currency ?? '—'
      const g = groups.get(key) ?? { spend: 0, value: 0, accountName: r.account_name }
      g.spend += Number(r.spend)
      g.value += Number(r.conversions_value)
      groups.set(key, g)
    }
    if (groups.size === 0) continue

    const metricValue = (g: { spend: number; value: number }) =>
      rule.metric === 'spend' ? g.spend : g.spend > 0 ? g.value / g.spend : 0

    let entries = [...groups.entries()]
    if (rule.comparator !== null && rule.threshold !== null) {
      entries = entries.filter(([, g]) =>
        matches(metricValue(g), rule.comparator!, Number(rule.threshold))
      )
      if (entries.length === 0) continue
    }

    const metricLabel = rule.metric === 'roas' ? 'ROAS' : 'Spend'
    const scope = rule.customer_id
      ? escapeHtml(entries[0][1].accountName ?? rule.customer_id)
      : 'All tracked accounts'
    const range = window.from === window.to ? window.from : `${window.from} → ${window.to}`

    const lines = [
      `📊 <b>${PERIOD_LABEL[rule.period]} ${metricLabel}</b> — ${range}`,
      scope,
      '',
    ]
    for (const [currency, g] of entries) {
      const roas = g.spend > 0 ? fmt(g.value / g.spend) : '—'
      lines.push(`<b>${escapeHtml(currency)}</b>  Spend ${fmt(g.spend)} · Value ${fmt(g.value)} · ROAS ${roas}`)
    }
    if (rule.comparator !== null && rule.threshold !== null) {
      lines.push('')
      lines.push(`✅ Rule matched: ${metricLabel} ${COMPARATOR_LABEL[rule.comparator]} ${fmt(Number(rule.threshold))}`)
    }

    const ok = await sendTelegramMessage(chatId, lines.join('\n'))
    if (!ok) {
      errors.push(`rule ${rule.id}: telegram send failed`)
      continue
    }
    sent++
    await supabase
      .from('notification_rules')
      .update({ last_sent_at: now.toISOString() })
      .eq('id', rule.id)
  }

  return { sent, errors }
}
