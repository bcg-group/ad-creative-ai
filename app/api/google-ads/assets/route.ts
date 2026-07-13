import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getConnectedAccounts, collectLeafAccounts, googleAdsQuery } from '@/utils/google-ads'

export const maxDuration = 60

const DATE_RANGE = 'LAST_30_DAYS'

// ad_group_ad_asset_view — asset-level performance for App campaigns.
// One row per (ad_group_ad, asset, field_type); metrics aggregate over the
// date range because segments.date is not selected.
const assetQuery = (campaignId: string) => `
  SELECT
    ad_group_ad_asset_view.field_type,
    ad_group_ad_asset_view.performance_label,
    ad_group_ad_asset_view.enabled,
    asset.id,
    asset.name,
    asset.text_asset.text,
    asset.image_asset.full_size.url,
    asset.youtube_video_asset.youtube_video_id,
    asset.youtube_video_asset.youtube_video_title,
    customer.currency_code,
    metrics.impressions,
    metrics.clicks,
    metrics.cost_micros,
    metrics.conversions,
    metrics.conversions_value
  FROM ad_group_ad_asset_view
  WHERE campaign.id = ${campaignId}
    AND segments.date DURING ${DATE_RANGE}
`

// Labels ranked worst→best; used to keep the label from the row with the
// most impressions, falling back to the better label on ties.
const LABEL_RANK: Record<string, number> = {
  UNSPECIFIED: 0, UNKNOWN: 0, PENDING: 1, LEARNING: 2, LOW: 3, GOOD: 4, BEST: 5,
}

export type AssetRow = {
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

export async function GET(req: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const customerId = searchParams.get('customer_id')?.replace(/-/g, '')
  const campaignId = searchParams.get('campaign_id')
  const accountEmail = searchParams.get('email')

  if (!customerId || !campaignId || !/^\d+$/.test(campaignId)) {
    return NextResponse.json({ error: 'customer_id and campaign_id are required' }, { status: 400 })
  }

  let accounts
  try {
    accounts = await getConnectedAccounts(user.id)
  } catch {
    return NextResponse.json({ error: 'Google Ads not connected' }, { status: 401 })
  }

  // Prefer the account the campaign was linked under, but fall back to all
  const ordered = accountEmail
    ? [...accounts].sort((a) => (a.googleAccountEmail === accountEmail ? -1 : 1))
    : accounts

  const debugErrors: string[] = []
  let rows: any[] | null = null
  let currency: string | null = null

  for (const { accessToken, googleAccountEmail } of ordered) {
    // Resolve the login-customer-id (top-level MCC) for this customer
    let leaves
    try {
      leaves = await collectLeafAccounts(accessToken, debugErrors)
    } catch (e: any) {
      debugErrors.push(`[${googleAccountEmail}] collectLeafAccounts: ${e?.message}`)
      continue
    }

    const leaf = leaves.find((l) => l.customerId === customerId)
    if (!leaf) continue

    try {
      rows = await googleAdsQuery(accessToken, customerId, assetQuery(campaignId), leaf.loginId)
      break
    } catch (e: any) {
      debugErrors.push(`[${customerId}] asset query: ${e?.message}`)
    }
  }

  if (rows === null) {
    return NextResponse.json(
      { error: 'Could not fetch assets for this campaign', debugErrors },
      { status: 502 }
    )
  }

  // Aggregate per asset+fieldType (same asset can serve in multiple ad groups)
  const byAsset = new Map<string, AssetRow & { labelImpressions: number }>()
  for (const row of rows) {
    const view = row.adGroupAdAssetView ?? {}
    const asset = row.asset ?? {}
    const metrics = row.metrics ?? {}
    currency = currency ?? row.customer?.currencyCode ?? null

    const fieldType = view.fieldType ?? 'UNKNOWN'
    const key = `${asset.id}:${fieldType}`
    const impressions = Number(metrics.impressions ?? 0)
    const label = view.performanceLabel ?? 'UNKNOWN'

    let agg = byAsset.get(key)
    if (!agg) {
      agg = {
        assetId: String(asset.id ?? ''),
        fieldType,
        performanceLabel: label,
        enabled: view.enabled ?? true,
        text: asset.textAsset?.text ?? null,
        imageUrl: asset.imageAsset?.fullSize?.url ?? null,
        youtubeVideoId: asset.youtubeVideoAsset?.youtubeVideoId ?? null,
        youtubeTitle: asset.youtubeVideoAsset?.youtubeVideoTitle ?? null,
        impressions: 0,
        clicks: 0,
        spend: 0,
        conversions: 0,
        ctr: 0,
        labelImpressions: -1,
      }
      byAsset.set(key, agg)
    }

    agg.impressions += impressions
    agg.clicks += Number(metrics.clicks ?? 0)
    agg.spend += Number(metrics.costMicros ?? 0) / 1_000_000
    agg.conversions += Number(metrics.conversions ?? 0)
    agg.enabled = agg.enabled || (view.enabled ?? false)

    // Keep the label from the highest-impression row (most representative)
    if (
      impressions > agg.labelImpressions ||
      (impressions === agg.labelImpressions &&
        (LABEL_RANK[label] ?? 0) > (LABEL_RANK[agg.performanceLabel] ?? 0))
    ) {
      agg.performanceLabel = label
      agg.labelImpressions = impressions
    }
  }

  const assets: AssetRow[] = [...byAsset.values()]
    .map((a) => ({
      assetId: a.assetId,
      fieldType: a.fieldType,
      performanceLabel: a.performanceLabel,
      enabled: a.enabled,
      text: a.text,
      imageUrl: a.imageUrl,
      youtubeVideoId: a.youtubeVideoId,
      youtubeTitle: a.youtubeTitle,
      impressions: a.impressions,
      clicks: a.clicks,
      spend: Math.round(a.spend * 100) / 100,
      conversions: Math.round(a.conversions * 10) / 10,
      ctr: a.impressions > 0 ? Math.round((a.clicks / a.impressions) * 10000) / 100 : 0,
    }))
    .sort((a, b) =>
      (LABEL_RANK[b.performanceLabel] ?? 0) - (LABEL_RANK[a.performanceLabel] ?? 0) ||
      b.impressions - a.impressions
    )

  return NextResponse.json({ assets, currency, dateRange: DATE_RANGE, debugErrors })
}
