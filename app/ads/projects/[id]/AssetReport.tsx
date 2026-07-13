'use client'

import { useEffect, useState } from 'react'

type AssetRow = {
  assetId: string
  fieldType: string
  performanceLabel: string
  enabled: boolean
  text: string | null
  imageUrl: string | null
  youtubeVideoId: string | null
  youtubeTitle: string | null
  impressions: number
  clicks: number
  spend: number
  conversions: number
  ctr: number
}

const FIELD_TYPE_LABEL: Record<string, string> = {
  HEADLINE: 'Headlines',
  DESCRIPTION: 'Descriptions',
  MARKETING_IMAGE: 'Images',
  YOUTUBE_VIDEO: 'Videos',
  MEDIA_BUNDLE: 'HTML5',
}

const FIELD_TYPE_ORDER = ['HEADLINE', 'DESCRIPTION', 'MARKETING_IMAGE', 'YOUTUBE_VIDEO', 'MEDIA_BUNDLE']

const LABEL_STYLE: Record<string, string> = {
  BEST: 'bg-green-100 text-green-700',
  GOOD: 'bg-blue-100 text-blue-700',
  LOW: 'bg-red-100 text-red-600',
  LEARNING: 'bg-amber-100 text-amber-700',
  PENDING: 'bg-gray-100 text-gray-500',
  UNKNOWN: 'bg-gray-100 text-gray-400',
}

export function normalizeText(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

function PerformanceBadge({ label }: { label: string }) {
  const style = LABEL_STYLE[label] ?? LABEL_STYLE.UNKNOWN
  const text = label === 'UNKNOWN' || label === 'UNSPECIFIED' ? '—' : label
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full tracking-wide ${style}`}>
      {text}
    </span>
  )
}

function AssetLabel({ asset }: { asset: AssetRow }) {
  if (asset.text) return <span className="text-gray-800">{asset.text}</span>
  if (asset.youtubeVideoId) {
    return (
      <a
        href={`https://www.youtube.com/watch?v=${asset.youtubeVideoId}`}
        target="_blank" rel="noopener noreferrer"
        className="text-blue-600 hover:underline"
      >
        {asset.youtubeTitle ?? asset.youtubeVideoId}
      </a>
    )
  }
  if (asset.imageUrl) {
    return (
      <a href={asset.imageUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 group">
        {/* eslint-disable-next-line @next/next/no-img-element -- external Google CDN thumbnail */}
        <img src={asset.imageUrl} alt="" className="h-8 w-14 object-cover rounded border border-gray-200" />
        <span className="text-blue-600 group-hover:underline text-xs">View image</span>
      </a>
    )
  }
  return <span className="text-gray-400">Asset {asset.assetId}</span>
}

export default function AssetReportModal({
  campaignId,
  campaignName,
  customerId,
  googleAccountEmail,
  aiTexts,
  onClose,
}: {
  campaignId: string
  campaignName: string
  customerId: string
  googleAccountEmail: string | null
  aiTexts: Set<string>
  onClose: () => void
}) {
  const [assets, setAssets] = useState<AssetRow[]>([])
  const [currency, setCurrency] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const params = new URLSearchParams({ customer_id: customerId, campaign_id: campaignId })
    if (googleAccountEmail) params.set('email', googleAccountEmail)
    fetch(`/api/google-ads/assets?${params}`)
      .then(async (r) => {
        const data = await r.json()
        if (!r.ok) throw new Error(data.error ?? 'Failed to load assets')
        setAssets(data.assets ?? [])
        setCurrency(data.currency ?? null)
        if (data.debugErrors?.length) console.warn('[Google Ads assets debug]', data.debugErrors)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load assets'))
      .finally(() => setLoading(false))
  }, [customerId, campaignId, googleAccountEmail])

  const groups = FIELD_TYPE_ORDER
    .map((ft) => ({ fieldType: ft, items: assets.filter((a) => a.fieldType === ft) }))
    .filter((g) => g.items.length > 0)
  const other = assets.filter((a) => !FIELD_TYPE_ORDER.includes(a.fieldType))
  if (other.length > 0) groups.push({ fieldType: 'OTHER', items: other })

  const fmtMoney = (v: number) =>
    `${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${currency ? ` ${currency}` : ''}`

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4 border-b border-gray-100">
          <div>
            <h3 className="font-semibold text-gray-900">Asset Report</h3>
            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-md">{campaignName} — last 30 days</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-6 pt-4 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-sm text-gray-400 gap-2">
              <svg className="animate-spin h-4 w-4 text-blue-500" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading assets... (traverses your MCC tree, may take ~10s)
            </div>
          ) : error ? (
            <p className="text-sm text-red-600 text-center py-10">{error}</p>
          ) : assets.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">
              No asset data for this campaign. Asset reporting is available for App campaigns only.
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.fieldType} className="space-y-2">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {FIELD_TYPE_LABEL[group.fieldType] ?? group.fieldType} ({group.items.length})
                </h4>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase">Asset</th>
                        <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase">Rating</th>
                        <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase">Impr.</th>
                        <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase">CTR%</th>
                        <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase">Spend</th>
                        <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase">Installs</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {group.items.map((a) => {
                        const isAi = a.text ? aiTexts.has(normalizeText(a.text)) : false
                        return (
                          <tr key={`${a.assetId}-${a.fieldType}`} className={!a.enabled ? 'opacity-50' : ''}>
                            <td className="px-3 py-2 max-w-xs">
                              <div className="flex items-center gap-1.5">
                                {isAi && (
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 flex-shrink-0"
                                    title="Generated by Ad Creative AI">
                                    AI
                                  </span>
                                )}
                                <span className="truncate"><AssetLabel asset={a} /></span>
                                {!a.enabled && <span className="text-[10px] text-gray-400 flex-shrink-0">(removed)</span>}
                              </div>
                            </td>
                            <td className="px-3 py-2"><PerformanceBadge label={a.performanceLabel} /></td>
                            <td className="px-3 py-2 text-right text-gray-700 tabular-nums">{a.impressions.toLocaleString()}</td>
                            <td className="px-3 py-2 text-right text-gray-700 tabular-nums">{a.ctr.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right text-gray-700 tabular-nums whitespace-nowrap">{fmtMoney(a.spend)}</td>
                            <td className="px-3 py-2 text-right text-gray-700 tabular-nums">{a.conversions.toLocaleString()}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
