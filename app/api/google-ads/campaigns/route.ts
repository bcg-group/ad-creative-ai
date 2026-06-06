import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getValidAccessToken, listAccessibleCustomers, googleAdsQuery } from '@/utils/google-ads'

const DATE_RANGE = 'LAST_30_DAYS'

export async function GET(req: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const filterCustomerId = searchParams.get('customer_id')

  let accessToken: string
  try {
    accessToken = await getValidAccessToken(user.id)
  } catch {
    return NextResponse.json({ error: 'Google Ads not connected' }, { status: 401 })
  }

  let customerIds = await listAccessibleCustomers(accessToken)
  if (filterCustomerId) customerIds = customerIds.filter((id) => id === filterCustomerId)

  const allCampaigns: any[] = []

  await Promise.all(
    customerIds.map(async (customerId) => {
      try {
        const rows = await googleAdsQuery(accessToken, customerId, `
          SELECT
            campaign.id,
            campaign.name,
            campaign.status,
            campaign.labels,
            customer.descriptive_name,
            customer.currency_code,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions,
            metrics.conversions_value,
            metrics.ctr,
            metrics.average_cpc
          FROM campaign
          WHERE campaign.status != 'REMOVED'
            AND segments.date DURING ${DATE_RANGE}
        `)

        for (const row of rows) {
          const { campaign, customer, metrics } = row

          const spend = (metrics.costMicros ?? 0) / 1_000_000
          const conversions = metrics.conversions ?? 0
          const conversionValue = metrics.conversionsValue ?? 0

          const cpi = conversions > 0 ? spend / conversions : null
          const roas = spend > 0 ? conversionValue / spend : null
          const ctr = metrics.ctr ?? 0

          allCampaigns.push({
            customerId,
            accountName: customer.descriptiveName,
            currency: customer.currencyCode,
            campaignId: String(campaign.id),
            campaignName: campaign.name,
            status: campaign.status,
            labels: campaign.labels ?? [],
            impressions: metrics.impressions ?? 0,
            clicks: metrics.clicks ?? 0,
            spend: Math.round(spend * 100) / 100,
            conversions: Math.round(conversions * 10) / 10,
            cpi: cpi !== null ? Math.round(cpi * 100) / 100 : null,
            roas: roas !== null ? Math.round(roas * 100) / 100 : null,
            ctr: Math.round(ctr * 10000) / 100,
          })
        }
      } catch {
        // skip accounts with errors (e.g. MCC itself has no campaigns)
      }
    })
  )

  // Sort by spend desc by default
  allCampaigns.sort((a, b) => b.spend - a.spend)

  return NextResponse.json({ campaigns: allCampaigns, dateRange: DATE_RANGE })
}
