'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

const DEMO_CAMPAIGNS: Campaign[] = [
  { customerId: '111', accountName: 'MyApp – VN', currency: 'USD', campaignId: '1', campaignName: 'UAC_iOS_VN_Installs_Jun', status: 'ENABLED', labels: [], impressions: 1820430, clicks: 24610, spend: 3241.85, conversions: 1820, cpi: 1.78, roas: 3.12, ctr: 1.35 },
  { customerId: '111', accountName: 'MyApp – VN', currency: 'USD', campaignId: '2', campaignName: 'UAC_Android_VN_Installs_Jun', status: 'ENABLED', labels: [], impressions: 2540100, clicks: 31820, spend: 4875.20, conversions: 2310, cpi: 2.11, roas: 2.87, ctr: 1.25 },
  { customerId: '222', accountName: 'MyApp – SEA', currency: 'USD', campaignId: '3', campaignName: 'UAC_iOS_TH_Installs_Jun', status: 'ENABLED', labels: [], impressions: 980200, clicks: 11450, spend: 1562.40, conversions: 890, cpi: 1.76, roas: 3.45, ctr: 1.17 },
  { customerId: '222', accountName: 'MyApp – SEA', currency: 'USD', campaignId: '4', campaignName: 'UAC_Android_PH_Installs_Jun', status: 'ENABLED', labels: [], impressions: 1120450, clicks: 9870, spend: 1089.60, conversions: 540, cpi: 2.02, roas: 2.10, ctr: 0.88 },
  { customerId: '333', accountName: 'MyApp – Global', currency: 'USD', campaignId: '5', campaignName: 'UAC_iOS_US_InApp_May', status: 'PAUSED', labels: [], impressions: 450210, clicks: 8760, spend: 6420.00, conversions: 310, cpi: 20.71, roas: 0.74, ctr: 1.95 },
  { customerId: '333', accountName: 'MyApp – Global', currency: 'USD', campaignId: '6', campaignName: 'UAC_Android_SEA_Retarget', status: 'PAUSED', labels: [], impressions: 230780, clicks: 3140, spend: 412.30, conversions: 195, cpi: 2.11, roas: 1.95, ctr: 1.36 },
  { customerId: '111', accountName: 'MyApp – VN', currency: 'USD', campaignId: '7', campaignName: 'UAC_iOS_VN_InApp_Jun', status: 'ENABLED', labels: [], impressions: 670340, clicks: 7820, spend: 2105.70, conversions: 780, cpi: 2.70, roas: 4.20, ctr: 1.17 },
]

const DEMO_ANALYSIS = `📊 Tổng quan hiệu suất (30 ngày gần nhất)

Top performer: UAC_iOS_TH_Installs_Jun (CPI $1.76, ROAS 3.45x) — đây là campaign hiệu quả nhất cần tăng budget.

⚠️ Cần chú ý: UAC_iOS_US_InApp_May đang tạm dừng với ROAS 0.74x — chi phí vượt doanh thu, nên xem xét lại creatives và targeting trước khi bật lại.

💡 Đề xuất:
• Tăng budget 20–30% cho các campaign VN và TH đang có CPI < $2.
• UAC_Android_PH có CTR thấp (0.88%) — thử A/B test banner mới.
• Campaign InApp VN đang có ROAS 4.20x — cân nhắc scale ngay tháng này.`

type Campaign = {
  customerId: string
  accountName: string
  currency: string
  campaignId: string
  campaignName: string
  status: string
  labels: string[]
  impressions: number
  clicks: number
  spend: number
  conversions: number
  cpi: number | null
  roas: number | null
  ctr: number
}

type SortKey = 'spend' | 'cpi' | 'roas' | 'conversions' | 'ctr'

function statusColor(status: string) {
  if (status === 'ENABLED') return 'bg-green-100 text-green-700'
  if (status === 'PAUSED') return 'bg-yellow-100 text-yellow-700'
  return 'bg-gray-100 text-gray-500'
}

function MetricCell({ value, format }: { value: number | null; format: string }) {
  if (value === null) return <span className="text-gray-300">—</span>
  if (format === 'currency') return <span>${value.toFixed(2)}</span>
  if (format === 'percent') return <span>{value.toFixed(2)}%</span>
  if (format === 'x') return <span>{value.toFixed(2)}x</span>
  return <span>{value.toLocaleString()}</span>
}

function DashboardContent() {
  const searchParams = useSearchParams()
  const justConnected = searchParams.get('connected') === 'true'
  const isDemo = searchParams.get('demo') === 'true'

  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('spend')
  const [sortAsc, setSortAsc] = useState(false)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysis, setAnalysis] = useState('')

  const fetchCampaigns = useCallback(async () => {
    if (isDemo) {
      setCampaigns(DEMO_CAMPAIGNS)
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/google-ads/campaigns')
      if (res.status === 401) {
        window.location.href = '/ads/connect'
        return
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load campaigns')
      setCampaigns(data.campaigns ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaigns')
    } finally {
      setLoading(false)
    }
  }, [isDemo])

  useEffect(() => { fetchCampaigns() }, [fetchCampaigns])

  const sorted = [...campaigns].sort((a, b) => {
    const av = a[sortKey] ?? (sortAsc ? Infinity : -Infinity)
    const bv = b[sortKey] ?? (sortAsc ? Infinity : -Infinity)
    return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number)
  })

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v)
    else { setSortKey(key); setSortAsc(false) }
  }

  const SortHeader = ({ label, k }: { label: string; k: SortKey }) => (
    <th
      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-700 select-none whitespace-nowrap"
      onClick={() => handleSort(k)}
    >
      {label} {sortKey === k ? (sortAsc ? '↑' : '↓') : ''}
    </th>
  )

  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0)
  const totalConversions = campaigns.reduce((s, c) => s + c.conversions, 0)
  const activeCampaigns = campaigns.filter((c) => c.status === 'ENABLED').length

  const runAnalysis = async () => {
    if (isDemo) {
      setAnalysisLoading(true)
      setAnalysis('')
      await new Promise((r) => setTimeout(r, 800))
      setAnalysis(DEMO_ANALYSIS)
      setAnalysisLoading(false)
      return
    }
    setAnalysisLoading(true)
    setAnalysis('')
    try {
      const res = await fetch('/api/google-ads/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaigns: sorted.slice(0, 30) }),
      })
      const data = await res.json()
      setAnalysis(data.analysis ?? '')
    } catch {
      setAnalysis('Không thể phân tích lúc này. Vui lòng thử lại.')
    } finally {
      setAnalysisLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Campaign Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">30 ngày gần nhất — tất cả accounts</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runAnalysis}
            disabled={analysisLoading || campaigns.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {analysisLoading ? (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            )}
            AI Analysis
          </button>
          <button onClick={fetchCampaigns} className="p-2 text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {isDemo && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 text-xs text-amber-700 font-medium">
          Demo mode — dữ liệu mẫu, không kết nối Google Ads thật
        </div>
      )}

      {justConnected && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700">
          Google Ads đã kết nối thành công! Đang tải campaign data...
        </div>
      )}

      {/* Summary cards */}
      {!loading && campaigns.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Spend', value: `$${totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
            { label: 'Total Installs', value: totalConversions.toLocaleString(undefined, { maximumFractionDigits: 0 }) },
            { label: 'Active Campaigns', value: `${activeCampaigns}/${campaigns.length}` },
          ].map((card) => (
            <div key={card.label} className="bg-white rounded-xl border border-gray-200 px-5 py-4">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{card.label}</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* AI Analysis */}
      {analysis && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <span className="text-sm font-semibold text-blue-700">AI Analysis</span>
          </div>
          <p className="text-sm text-blue-800 leading-relaxed whitespace-pre-line">{analysis}</p>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-sm text-gray-400 gap-2">
            <svg className="animate-spin h-5 w-5 text-blue-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading campaigns...
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <p className="text-sm text-red-600">{error}</p>
            {error.includes('token') && (
              <a href="/ads/connect" className="text-sm text-blue-600 hover:underline">Reconnect Google Ads →</a>
            )}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <p className="text-sm text-gray-500">Không tìm thấy campaign nào.</p>
            <a href="/ads/connect" className="mt-2 text-sm text-blue-600 hover:underline">Connect Google Ads →</a>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Campaign</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Account</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <SortHeader label="Spend" k="spend" />
                  <SortHeader label="Installs" k="conversions" />
                  <SortHeader label="CPI" k="cpi" />
                  <SortHeader label="ROAS" k="roas" />
                  <SortHeader label="CTR%" k="ctr" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sorted.map((c) => (
                  <tr key={`${c.customerId}-${c.campaignId}`} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate">{c.campaignName}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{c.accountName}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor(c.status)}`}>
                        {c.status === 'ENABLED' ? 'Active' : c.status === 'PAUSED' ? 'Paused' : c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 tabular-nums">
                      <MetricCell value={c.spend} format="currency" />
                    </td>
                    <td className="px-4 py-3 text-gray-700 tabular-nums">
                      <MetricCell value={c.conversions} format="number" />
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      <span className={c.cpi !== null && c.cpi < 2 ? 'text-green-600 font-medium' : c.cpi !== null && c.cpi > 5 ? 'text-red-500' : 'text-gray-700'}>
                        <MetricCell value={c.cpi} format="currency" />
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      <span className={c.roas !== null && c.roas >= 2 ? 'text-green-600 font-medium' : c.roas !== null && c.roas < 1 ? 'text-red-500' : 'text-gray-700'}>
                        <MetricCell value={c.roas} format="x" />
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 tabular-nums">
                      <MetricCell value={c.ctr} format="percent" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardContent />
    </Suspense>
  )
}
