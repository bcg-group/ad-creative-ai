'use client'

import { useState } from 'react'

type Campaign = {
  customerId: string
  accountName: string
  campaignId: string
  campaignName: string
  status: string
  impressions: number
  clicks: number
  spend: number
  conversions: number
  cpi: number | null
  roas: number | null
  ctr: number
}

type SortKey = 'spend' | 'cpi' | 'roas' | 'conversions' | 'ctr'

const DEMO_CAMPAIGNS: Campaign[] = [
  { customerId: '111', accountName: 'MyApp – VN', campaignId: '1', campaignName: 'UAC_iOS_VN_Installs_Jun', status: 'ENABLED', impressions: 1820430, clicks: 24610, spend: 3241.85, conversions: 1820, cpi: 1.78, roas: 3.12, ctr: 1.35 },
  { customerId: '111', accountName: 'MyApp – VN', campaignId: '2', campaignName: 'UAC_Android_VN_Installs_Jun', status: 'ENABLED', impressions: 2540100, clicks: 31820, spend: 4875.20, conversions: 2310, cpi: 2.11, roas: 2.87, ctr: 1.25 },
  { customerId: '222', accountName: 'MyApp – SEA', campaignId: '3', campaignName: 'UAC_iOS_TH_Installs_Jun', status: 'ENABLED', impressions: 980200, clicks: 11450, spend: 1562.40, conversions: 890, cpi: 1.76, roas: 3.45, ctr: 1.17 },
  { customerId: '222', accountName: 'MyApp – SEA', campaignId: '4', campaignName: 'UAC_Android_PH_Installs_Jun', status: 'ENABLED', impressions: 1120450, clicks: 9870, spend: 1089.60, conversions: 540, cpi: 2.02, roas: 2.10, ctr: 0.88 },
  { customerId: '333', accountName: 'MyApp – Global', campaignId: '5', campaignName: 'UAC_iOS_US_InApp_May', status: 'PAUSED', impressions: 450210, clicks: 8760, spend: 6420.00, conversions: 310, cpi: 20.71, roas: 0.74, ctr: 1.95 },
  { customerId: '333', accountName: 'MyApp – Global', campaignId: '6', campaignName: 'UAC_Android_SEA_Retarget', status: 'PAUSED', impressions: 230780, clicks: 3140, spend: 412.30, conversions: 195, cpi: 2.11, roas: 1.95, ctr: 1.36 },
  { customerId: '111', accountName: 'MyApp – VN', campaignId: '7', campaignName: 'UAC_iOS_VN_InApp_Jun', status: 'ENABLED', impressions: 670340, clicks: 7820, spend: 2105.70, conversions: 780, cpi: 2.70, roas: 4.20, ctr: 1.17 },
]

const DEMO_ANALYSIS = `Top performer: UAC_iOS_TH_Installs_Jun (CPI $1.76, ROAS 3.45x) — most efficient campaign, consider increasing budget by 20–30%.

⚠️ Action needed: UAC_iOS_US_InApp_May is paused with ROAS 0.74x — spend exceeds revenue. Review creatives and targeting before re-enabling.

Recommendations:
• Scale budget for VN and TH campaigns with CPI < $2.
• UAC_Android_PH has low CTR (0.88%) — run an A/B test with new banner creatives.
• UAC_iOS_VN_InApp_Jun is delivering ROAS 4.20x — strong candidate for scaling this month.`

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
  return <span>{value.toLocaleString('en-US')}</span>
}

export default function DemoPage() {
  const [sortKey, setSortKey] = useState<SortKey>('spend')
  const [sortAsc, setSortAsc] = useState(false)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysis, setAnalysis] = useState('')

  const sorted = [...DEMO_CAMPAIGNS].sort((a, b) => {
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

  const totalSpend = DEMO_CAMPAIGNS.reduce((s, c) => s + c.spend, 0)
  const totalConversions = DEMO_CAMPAIGNS.reduce((s, c) => s + c.conversions, 0)
  const activeCampaigns = DEMO_CAMPAIGNS.filter((c) => c.status === 'ENABLED').length

  const runAnalysis = async () => {
    setAnalysisLoading(true)
    setAnalysis('')
    await new Promise((r) => setTimeout(r, 900))
    setAnalysis(DEMO_ANALYSIS)
    setAnalysisLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-xs font-bold">Ad</span>
          </div>
          <span className="text-base font-semibold text-gray-900">Ad Creative AI</span>
        </div>
        <span className="text-gray-300">|</span>
        <span className="text-sm font-medium text-gray-500">Ads Management</span>
        <div className="ml-auto">
          <span className="text-xs bg-amber-100 text-amber-700 font-medium px-2.5 py-1 rounded-full">
            Demo mode
          </span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-52 bg-white border-r border-gray-200 flex-shrink-0 py-4">
          <nav className="px-3 space-y-0.5">
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm bg-blue-50 text-blue-700 font-medium">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Dashboard
            </div>
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              Projects
            </div>
          </nav>
          <div className="mt-6 px-3 border-t border-gray-100 pt-4">
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Google Ads Account
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-auto p-6">
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Campaign Dashboard</h1>
                <p className="text-sm text-gray-500 mt-0.5">Last 30 days — all accounts</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={runAnalysis}
                  disabled={analysisLoading}
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
              </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Total Spend', value: `$${totalSpend.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
                { label: 'Total Installs', value: totalConversions.toLocaleString('en-US') },
                { label: 'Active Campaigns', value: `${activeCampaigns} / ${DEMO_CAMPAIGNS.length}` },
              ].map((card) => (
                <div key={card.label} className="bg-white rounded-xl border border-gray-200 px-5 py-4">
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{card.label}</p>
                  <p className="text-2xl font-semibold text-gray-900 mt-1">{card.value}</p>
                </div>
              ))}
            </div>

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
                            {c.status === 'ENABLED' ? 'Active' : 'Paused'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700 tabular-nums"><MetricCell value={c.spend} format="currency" /></td>
                        <td className="px-4 py-3 text-gray-700 tabular-nums"><MetricCell value={c.conversions} format="number" /></td>
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
                        <td className="px-4 py-3 text-gray-700 tabular-nums"><MetricCell value={c.ctr} format="percent" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
