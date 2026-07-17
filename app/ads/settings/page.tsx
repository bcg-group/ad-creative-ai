'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

type TelegramStatus = {
  linked: boolean
  username: string | null
  botConfigured: boolean
}

type Comparator = 'gt' | 'gte' | 'lt' | 'lte'

type RuleMetric =
  | 'roas' | 'spend' | 'conversions' | 'conversions_value'
  | 'cpi' | 'cpc' | 'ctr' | 'clicks' | 'impressions'

type Rule = {
  id: number
  metric: RuleMetric
  period: 'day' | 'week' | 'month'
  comparator: Comparator | null
  threshold: number | null
  customer_id: string | null
  enabled: boolean
  last_sent_at: string | null
}

type AccountOption = {
  customer_id: string
  name: string | null
}

const METRIC_LABEL: Record<RuleMetric, string> = {
  roas: 'ROAS',
  spend: 'Spend',
  conversions: 'Conversions',
  conversions_value: 'Conv. value',
  cpi: 'CPI (cost / conv.)',
  cpc: 'CPC',
  ctr: 'CTR (%)',
  clicks: 'Clicks',
  impressions: 'Impressions',
}

const THRESHOLD_HINT: Record<RuleMetric, string> = {
  roas: 'e.g. 1',
  spend: 'e.g. 500',
  conversions: 'e.g. 100',
  conversions_value: 'e.g. 1000',
  cpi: 'e.g. 2.5',
  cpc: 'e.g. 0.5',
  ctr: 'e.g. 2 (%)',
  clicks: 'e.g. 1000',
  impressions: 'e.g. 50000',
}
const PERIOD_LABEL = { day: 'Daily', week: 'Weekly', month: 'Monthly' }
const COMPARATOR_LABEL: Record<Comparator, string> = { gt: '>', gte: '≥', lt: '<', lte: '≤' }

function formatCustomerId(id: string) {
  return id.length === 10 ? `${id.slice(0, 3)}-${id.slice(3, 6)}-${id.slice(6)}` : id
}

function ruleDescription(rule: Rule, accounts: AccountOption[]) {
  const scope = rule.customer_id
    ? accounts.find((a) => a.customer_id === rule.customer_id)?.name ??
      formatCustomerId(rule.customer_id)
    : 'All tracked accounts'
  const condition =
    rule.comparator && rule.threshold !== null
      ? `only when ${METRIC_LABEL[rule.metric]} ${COMPARATOR_LABEL[rule.comparator]} ${rule.threshold}`
      : 'always'
  return `${PERIOD_LABEL[rule.period]} ${METRIC_LABEL[rule.metric]} · ${scope} · ${condition}`
}

export default function SettingsPage() {
  const supabase = createClient()

  // --- Telegram link state ---
  const [tg, setTg] = useState<TelegramStatus | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchTgStatus = useCallback(async (): Promise<TelegramStatus | null> => {
    const res = await fetch('/api/telegram/link')
    if (!res.ok) return null
    const data = (await res.json()) as TelegramStatus
    setTg(data)
    return data
  }, [])

  useEffect(() => {
    fetchTgStatus()
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [fetchTgStatus])

  const connect = async () => {
    setConnecting(true)
    setTestResult(null)
    const res = await fetch('/api/telegram/link', { method: 'POST' })
    const data = await res.json()
    if (!res.ok) {
      setTestResult(data.error ?? 'Failed to create link')
      setConnecting(false)
      return
    }
    window.open(data.url, '_blank')
    // Poll until the webhook stores chat_id (max ~2 minutes)
    let tries = 0
    pollRef.current = setInterval(async () => {
      tries++
      const status = await fetchTgStatus()
      if (status?.linked || tries >= 40) {
        if (pollRef.current) clearInterval(pollRef.current)
        setConnecting(false)
      }
    }, 3000)
  }

  const disconnect = async () => {
    await fetch('/api/telegram/link', { method: 'DELETE' })
    setTestResult(null)
    fetchTgStatus()
  }

  const sendTest = async () => {
    setTestResult(null)
    const res = await fetch('/api/telegram/test', { method: 'POST' })
    const data = await res.json()
    setTestResult(res.ok ? 'Test message sent ✓' : data.error ?? 'Failed to send')
  }

  // --- Notification rules state ---
  const [rules, setRules] = useState<Rule[]>([])
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [rulesLoading, setRulesLoading] = useState(true)

  const [formMetric, setFormMetric] = useState<RuleMetric>('roas')
  const [formPeriod, setFormPeriod] = useState<'day' | 'week' | 'month'>('day')
  const [formAccount, setFormAccount] = useState('')
  const [formCondition, setFormCondition] = useState<'always' | Comparator>('always')
  const [formThreshold, setFormThreshold] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const loadRules = useCallback(async () => {
    const [{ data: ruleRows }, { data: accountRows }] = await Promise.all([
      supabase
        .from('notification_rules')
        .select('*')
        .order('created_at', { ascending: true }),
      supabase
        .from('ad_accounts')
        .select('customer_id, name')
        .eq('is_manager', false)
        .eq('tracked', true)
        .order('name'),
    ])
    setRules((ruleRows as Rule[]) ?? [])
    setAccounts((accountRows as AccountOption[]) ?? [])
    setRulesLoading(false)
  }, [supabase])

  useEffect(() => {
    loadRules()
  }, [loadRules])

  const addRule = async () => {
    setFormError(null)
    const conditional = formCondition !== 'always'
    const threshold = Number(formThreshold)
    if (conditional && (formThreshold.trim() === '' || !Number.isFinite(threshold))) {
      setFormError('Enter a numeric threshold value')
      return
    }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setFormError('Not signed in')
      setSaving(false)
      return
    }
    const { error } = await supabase.from('notification_rules').insert({
      user_id: user.id,
      metric: formMetric,
      period: formPeriod,
      comparator: conditional ? formCondition : null,
      threshold: conditional ? threshold : null,
      customer_id: formAccount || null,
    })
    setSaving(false)
    if (error) {
      setFormError(error.message)
      return
    }
    setFormThreshold('')
    setFormCondition('always')
    loadRules()
  }

  const toggleRule = async (rule: Rule) => {
    setRules((rs) => rs.map((r) => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r)))
    await supabase.from('notification_rules').update({ enabled: !rule.enabled }).eq('id', rule.id)
  }

  const deleteRule = async (id: number) => {
    setRules((rs) => rs.filter((r) => r.id !== id))
    await supabase.from('notification_rules').delete().eq('id', id)
  }

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Settings</h1>

      {/* Telegram */}
      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Telegram notifications</h2>
            <p className="text-sm text-gray-500 mt-1">
              Link a Telegram chat to receive account status alerts and scheduled metric reports.
            </p>
          </div>
          {tg?.linked && (
            <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 whitespace-nowrap">
              Linked{tg.username ? ` · @${tg.username}` : ''}
            </span>
          )}
        </div>

        <div className="mt-4 flex items-center gap-3">
          {tg === null ? (
            <span className="text-sm text-gray-400">Loading…</span>
          ) : !tg.botConfigured ? (
            <span className="text-sm text-amber-600">
              Bot is not configured — set TELEGRAM_BOT_TOKEN and TELEGRAM_BOT_USERNAME.
            </span>
          ) : tg.linked ? (
            <>
              <button
                onClick={sendTest}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Send test message
              </button>
              <button
                onClick={disconnect}
                className="px-3 py-1.5 text-sm rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
              >
                Disconnect
              </button>
            </>
          ) : (
            <button
              onClick={connect}
              disabled={connecting}
              className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {connecting ? 'Waiting for Telegram…' : 'Connect Telegram'}
            </button>
          )}
          {testResult && <span className="text-sm text-gray-500">{testResult}</span>}
        </div>
      </section>

      {/* Notification rules */}
      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-900">Notification rules</h2>
        <p className="text-sm text-gray-500 mt-1">
          Scheduled reports on spend and ROAS. Daily rules cover yesterday, weekly rules fire on
          Monday for the previous week, monthly rules on the 1st for the previous month. Rules
          with a condition only send when the condition is met.
        </p>

        {/* Add rule form */}
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <label className="text-sm text-gray-600">
            <span className="block text-xs text-gray-400 mb-1">Metric</span>
            <select
              value={formMetric}
              onChange={(e) => setFormMetric(e.target.value as RuleMetric)}
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white"
            >
              {(Object.keys(METRIC_LABEL) as RuleMetric[]).map((m) => (
                <option key={m} value={m}>{METRIC_LABEL[m]}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-gray-600">
            <span className="block text-xs text-gray-400 mb-1">Period</span>
            <select
              value={formPeriod}
              onChange={(e) => setFormPeriod(e.target.value as 'day' | 'week' | 'month')}
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white"
            >
              <option value="day">Daily</option>
              <option value="week">Weekly</option>
              <option value="month">Monthly</option>
            </select>
          </label>
          <label className="text-sm text-gray-600">
            <span className="block text-xs text-gray-400 mb-1">Account</span>
            <select
              value={formAccount}
              onChange={(e) => setFormAccount(e.target.value)}
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white max-w-52"
            >
              <option value="">All tracked accounts</option>
              {accounts.map((a) => (
                <option key={a.customer_id} value={a.customer_id}>
                  {a.name ?? formatCustomerId(a.customer_id)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-gray-600">
            <span className="block text-xs text-gray-400 mb-1">Condition</span>
            <select
              value={formCondition}
              onChange={(e) => setFormCondition(e.target.value as 'always' | Comparator)}
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white"
            >
              <option value="always">Always send</option>
              <option value="gt">&gt;</option>
              <option value="gte">≥</option>
              <option value="lt">&lt;</option>
              <option value="lte">≤</option>
            </select>
          </label>
          {formCondition !== 'always' && (
            <label className="text-sm text-gray-600">
              <span className="block text-xs text-gray-400 mb-1">Value</span>
              <input
                type="number"
                step="any"
                value={formThreshold}
                onChange={(e) => setFormThreshold(e.target.value)}
                placeholder={THRESHOLD_HINT[formMetric]}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm w-24"
              />
            </label>
          )}
          <button
            onClick={addRule}
            disabled={saving}
            className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            Add rule
          </button>
        </div>
        {formError && <p className="mt-2 text-sm text-red-600">{formError}</p>}

        {/* Rule list */}
        <div className="mt-5 divide-y divide-gray-100">
          {rulesLoading ? (
            <p className="text-sm text-gray-400 py-3">Loading…</p>
          ) : rules.length === 0 ? (
            <p className="text-sm text-gray-400 py-3">No rules yet.</p>
          ) : (
            rules.map((rule) => (
              <div key={rule.id} className="flex items-center gap-3 py-2.5">
                <button
                  onClick={() => toggleRule(rule)}
                  role="switch"
                  aria-checked={rule.enabled}
                  className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
                    rule.enabled ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                      rule.enabled ? 'translate-x-4' : ''
                    }`}
                  />
                </button>
                <span
                  className={`text-sm flex-1 ${rule.enabled ? 'text-gray-800' : 'text-gray-400'}`}
                >
                  {ruleDescription(rule, accounts)}
                </span>
                {rule.last_sent_at && (
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    last sent {new Date(rule.last_sent_at).toLocaleDateString()}
                  </span>
                )}
                <button
                  onClick={() => deleteRule(rule.id)}
                  className="text-gray-300 hover:text-red-500 transition-colors"
                  title="Delete rule"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}
