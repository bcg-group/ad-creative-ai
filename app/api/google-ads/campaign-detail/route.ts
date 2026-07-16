import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getConnectedAccounts, googleAdsQuery } from '@/utils/google-ads'

// Detailed campaign metrics for ONE account over a custom date range.
// Runs two queries and merges them so EVERY non-removed campaign appears,
// even those with no activity in the range (metrics default to 0).

const DATE = /^\d{4}-\d{2}-\d{2}$/

function supa(req: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} } }
  )
}

export async function GET(req: NextRequest) {
  const supabase = supa(req)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const customerId = searchParams.get('customer_id')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  if (!customerId) return NextResponse.json({ error: 'customer_id required' }, { status: 400 })
  if (!from || !to || !DATE.test(from) || !DATE.test(to)) {
    return NextResponse.json({ error: 'from and to (YYYY-MM-DD) required' }, { status: 400 })
  }

  const { data: acct } = await supabase
    .from('ad_accounts')
    .select('login_customer_id, google_account_email, is_manager')
    .eq('customer_id', customerId)
    .maybeSingle()
  if (!acct) return NextResponse.json({ error: 'Account not synced' }, { status: 404 })
  if (acct.is_manager) return NextResponse.json({ campaigns: [] })

  let accounts
  try {
    accounts = await getConnectedAccounts(user.id)
  } catch {
    return NextResponse.json({ error: 'Google Ads not connected' }, { status: 401 })
  }
  const match = accounts.find((a) => a.googleAccountEmail === acct.google_account_email)
  if (!match) return NextResponse.json({ error: 'Google login not connected' }, { status: 401 })

  const login = acct.login_customer_id ?? undefined

  try {
    const [allRows, metricRows] = await Promise.all([
      googleAdsQuery(match.accessToken, customerId,
        `SELECT campaign.id, campaign.name, campaign.status
         FROM campaign WHERE campaign.status != 'REMOVED' ORDER BY campaign.name`, login),
      googleAdsQuery(match.accessToken, customerId,
        `SELECT campaign.id, metrics.impressions, metrics.clicks, metrics.cost_micros,
                metrics.conversions, metrics.conversions_value
         FROM campaign
         WHERE campaign.status != 'REMOVED'
           AND segments.date BETWEEN '${from}' AND '${to}'`, login),
    ])

    const metrics = new Map<string, any>()
    for (const r of metricRows) metrics.set(String(r.campaign.id), r.metrics)

    const campaigns = allRows.map((r: any) => {
      const m = metrics.get(String(r.campaign.id))
      const impressions = Number(m?.impressions ?? 0)
      const clicks = Number(m?.clicks ?? 0)
      const spend = Number(m?.costMicros ?? 0) / 1_000_000
      const conversions = Number(m?.conversions ?? 0)
      const conversionsValue = Number(m?.conversionsValue ?? 0)
      return {
        campaignId: String(r.campaign.id),
        campaignName: r.campaign.name,
        status: r.campaign.status,
        impressions,
        clicks,
        spend: Math.round(spend * 100) / 100,
        conversions: Math.round(conversions * 10) / 10,
        conversionsValue: Math.round(conversionsValue * 100) / 100,
        ctr: impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0,
        cpc: clicks > 0 ? Math.round((spend / clicks) * 100) / 100 : null,
        cpi: conversions > 0 ? Math.round((spend / conversions) * 100) / 100 : null,
        roas: spend > 0 ? Math.round((conversionsValue / spend) * 100) / 100 : null,
      }
    })

    return NextResponse.json({ campaigns })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Query failed' }, { status: 500 })
  }
}
