import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getConnectedAccounts, googleAdsQuery } from '@/utils/google-ads'

// Campaigns for a SINGLE account, queried directly via the login_customer_id
// stored in ad_accounts — no MCC traversal, so it returns in ~1s. Powers the
// inline campaign panel on /ads/accounts.
const CAMPAIGN_QUERY = `
  SELECT
    campaign.id,
    campaign.name,
    campaign.status,
    metrics.cost_micros,
    metrics.conversions,
    metrics.conversions_value,
    metrics.ctr
  FROM campaign
  WHERE campaign.status != 'REMOVED'
    AND segments.date DURING LAST_30_DAYS
`

function rowToCampaign(row: any) {
  const { campaign, metrics } = row
  const spend = Number(metrics.costMicros ?? 0) / 1_000_000
  const conversions = Number(metrics.conversions ?? 0)
  const conversionValue = Number(metrics.conversionsValue ?? 0)
  return {
    campaignId: String(campaign.id),
    campaignName: campaign.name,
    status: campaign.status,
    spend: Math.round(spend * 100) / 100,
    conversions: Math.round(conversions * 10) / 10,
    cpi: conversions > 0 ? Math.round((spend / conversions) * 100) / 100 : null,
    roas: spend > 0 ? Math.round((conversionValue / spend) * 100) / 100 : null,
    ctr: Math.round((metrics.ctr ?? 0) * 10000) / 100,
  }
}

export async function GET(req: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const customerId = new URL(req.url).searchParams.get('customer_id')
  if (!customerId) return NextResponse.json({ error: 'customer_id required' }, { status: 400 })

  // Look up the stored account row (RLS: user reads own) for login + which login owns it
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

  try {
    const rows = await googleAdsQuery(
      match.accessToken,
      customerId,
      CAMPAIGN_QUERY,
      acct.login_customer_id ?? undefined
    )
    const campaigns = rows.map(rowToCampaign).sort((a, b) => b.spend - a.spend)
    return NextResponse.json({ campaigns })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Query failed' }, { status: 500 })
  }
}
