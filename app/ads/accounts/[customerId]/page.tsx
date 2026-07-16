'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

type Campaign = {
  campaignId: string
  campaignName: string
  status: string
  impressions: number
  clicks: number
  spend: number
  conversions: number
  conversionsValue: number
  ctr: number
  cpc: number | null
  cpi: number | null
  roas: number | null
}

type AccountMeta = {
  name: string | null
  currency: string | null
  status: string | null
  is_manager: boolean
}

function formatCustomerId(id: string) {
  return id.length === 10 ? `${id.slice(0, 3)}-${id.slice(3, 6)}-${id.slice(6)}` : id
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

const PRESETS: { key: string; label: string; range: () => { from: string; to: string } }[] = [
  { key: 'today', label: 'Hôm nay', range: () => ({ from: ymd(new Date()), to: ymd(new Date()) }) },
  { key: 'yesterday', label: 'Hôm qua', range: () => ({ from: ymd(daysAgo(1)), to: ymd(daysAgo(1)) }) },
  { key: 'last7', label: '7 ngày qua', range: () => ({ from: ymd(daysAgo(6)), to: ymd(new Date()) }) },
  { key: 'last14', label: '14 ngày qua', range: () => ({ from: ymd(daysAgo(13)), to: ymd(new Date()) }) },
  { key: 'last30', label: '30 ngày qua', range: () => ({ from: ymd(daysAgo(29)), to: ymd(new Date()) }) },
  {
    key: 'thisMonth', label: 'Tháng này', range: () => {
      const now = new Date()
      return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: ymd(now) }
    },
  },
  {
    key: 'lastMonth', label: 'Tháng trước', range: () => {
      const now = new Date()
      return {
        from: ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        to: ymd(new Date(now.getFullYear(), now.getMonth(), 0)),
      }
    },
  },
]

function campaignStatusDisplay(status: string): { label: string; className: string } {
  switch ((status ?? '').toUpperCase()) {
    case 'ENABLED': return { label: 'Enabled', className: 'bg-green-100 text-green-700' }
    case 'PAUSED': return { label: 'Paused', className: 'bg-amber-100 text-amber-700' }
    default: return { label: status || '—', className: 'bg-gray-100 text-gray-500' }
  }
}

export default function AccountDetailPage() {
  const params = useParams()
  const customerId = String(params.customerId)
  const supabase = createClient()

  const [meta, setMeta] = useState<AccountMeta | null>(null)
  const [preset, setPreset] = useState('last7')
  const initial = PRESETS.find((p) => p.key === 'last7')!.range()
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)

  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mutating, setMutating] = useState<Set<string>>(new Set())

  useEffect(() => {
    supabase
      .from('ad_accounts')
      .select('name, currency, status, is_manager')
      .eq('customer_id', customerId)
      .maybeSingle()
      .then(({ data }) => setMeta((data as AccountMeta) ?? null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/google-ads/campaign-detail?customer_id=${customerId}&from=${from}&to=${to}`)
      .then(async (res) => {
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) { setError(data.error ?? 'Load failed'); setCampaigns([]) }
        else setCampaigns(data.campaigns as Campaign[])
      })
      .catch(() => { if (!cancelled) setError('Load failed') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [customerId, from, to])

  const applyPreset = (key: string) => {
    setPreset(key)
    const p = PRESETS.find((x) => x.key === key)
    if (p) { const r = p.range(); setFrom(r.from); setTo(r.to) }
  }

  const toggleStatus = async (c: Campaign) => {
    const next = c.status === 'ENABLED' ? 'PAUSED' : 'ENABLED'
    setMutating((prev) => new Set(prev).add(c.campaignId))
    setCampaigns((prev) => prev.map((x) => x.campaignId === c.campaignId ? { ...x, status: next } : x))
    try {
      const res = await fetch('/api/google-ads/account-campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: customerId, campaign_id: c.campaignId, status: next }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setCampaigns((prev) => prev.map((x) => x.campaignId === c.campaignId ? { ...x, status: c.status } : x))
    }
    setMutating((prev) => { const n = new Set(prev); n.delete(c.campaignId); return n })
  }

  const currency = meta?.currency ?? ''

  const totals = useMemo(() => campaigns.reduce((t, c) => ({
    impressions: t.impressions + c.impressions,
    clicks: t.clicks + c.clicks,
    spend: t.spend + c.spend,
    conversions: t.conversions + c.conversions,
    conversionsValue: t.conversionsValue + c.conversionsValue,
  }), { impressions: 0, clicks: 0, spend: 0, conversions: 0, conversionsValue: 0 }), [campaigns])

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div>
        <Link href="/ads/accounts" className="text-sm text-blue-600 hover:underline">← Quay lại danh sách account</Link>
        <div className="flex items-center gap-3 mt-2">
          <h1 className="text-xl font-semibold text-gray-900">{meta?.name || formatCustomerId(customerId)}</h1>
          <span className="text-sm text-gray-400">{formatCustomerId(customerId)}</span>
          {meta?.currency && <span className="text-xs text-gray-500 bg-gray-100 rounded px-2 py-0.5">{meta.currency}</span>}
        </div>
      </div>

      {/* Date filter */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => applyPreset(p.key)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                preset === p.key ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">Từ</span>
          <input
            type="date" value={from} max={to}
            onChange={(e) => { setPreset('custom'); setFrom(e.target.value) }}
            className="border border-gray-200 rounded-lg px-2 py-1 text-sm"
          />
          <span className="text-gray-500">đến</span>
          <input
            type="date" value={to} min={from} max={ymd(new Date())}
            onChange={(e) => { setPreset('custom'); setTo(e.target.value) }}
            className="border border-gray-200 rounded-lg px-2 py-1 text-sm"
          />
        </div>
      </div>

      {meta?.is_manager ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
          Đây là tài khoản quản lý (MCC) — không có campaign trực tiếp.
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">{error}</div>
      ) : loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-10 justify-center">
          <svg className="animate-spin h-4 w-4 text-blue-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Đang tải dữ liệu...
        </div>
      ) : campaigns.length === 0 ? (
        <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 px-5 py-8 text-center text-sm text-gray-400">
          Không có campaign nào.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead>
                <tr className="text-left text-xs font-semibold text-gray-500 border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-2.5">Campaign</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Impr.</th>
                  <th className="px-4 py-2.5 text-right">Clicks</th>
                  <th className="px-4 py-2.5 text-right">CTR</th>
                  <th className="px-4 py-2.5 text-right">CPC</th>
                  <th className="px-4 py-2.5 text-right">Cost</th>
                  <th className="px-4 py-2.5 text-right">Conv.</th>
                  <th className="px-4 py-2.5 text-right">CPI</th>
                  <th className="px-4 py-2.5 text-right">Conv. value</th>
                  <th className="px-4 py-2.5 text-right">ROAS</th>
                  <th className="px-4 py-2.5 text-right">Bật/Tắt</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => {
                  const cs = campaignStatusDisplay(c.status)
                  const enabled = c.status === 'ENABLED'
                  const busy = mutating.has(c.campaignId)
                  return (
                    <tr key={c.campaignId} className="border-b border-gray-50 hover:bg-gray-50/60">
                      <td className="px-4 py-2.5 text-gray-800 max-w-[280px] truncate">{c.campaignName}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${cs.className}`}>{cs.label}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{c.impressions.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{c.clicks.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{c.ctr}%</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{c.cpc ?? '—'}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{c.spend.toLocaleString()} {currency}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{c.conversions}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{c.cpi ?? '—'}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{c.conversionsValue.toLocaleString()} {currency}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{c.roas ?? '—'}</td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => toggleStatus(c)}
                          disabled={busy}
                          title={enabled ? 'Đang bật — bấm để tạm dừng' : 'Đang tạm dừng — bấm để bật'}
                          className={`relative inline-block w-9 h-5 rounded-full transition-colors align-middle disabled:opacity-50 ${enabled ? 'bg-green-500' : 'bg-gray-300'}`}
                        >
                          <span className={`absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200 font-medium text-gray-800 bg-gray-50">
                  <td className="px-4 py-2.5" colSpan={2}>Tổng ({campaigns.length} campaign)</td>
                  <td className="px-4 py-2.5 text-right">{totals.impressions.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right">{totals.clicks.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right">{totals.impressions > 0 ? Math.round((totals.clicks / totals.impressions) * 10000) / 100 : 0}%</td>
                  <td className="px-4 py-2.5"></td>
                  <td className="px-4 py-2.5 text-right">{Math.round(totals.spend * 100) / 100} {currency}</td>
                  <td className="px-4 py-2.5 text-right">{Math.round(totals.conversions * 10) / 10}</td>
                  <td className="px-4 py-2.5 text-right">{totals.conversions > 0 ? Math.round((totals.spend / totals.conversions) * 100) / 100 : '—'}</td>
                  <td className="px-4 py-2.5 text-right">{Math.round(totals.conversionsValue * 100) / 100} {currency}</td>
                  <td className="px-4 py-2.5 text-right">{totals.spend > 0 ? Math.round((totals.conversionsValue / totals.spend) * 100) / 100 : '—'}</td>
                  <td className="px-4 py-2.5"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
