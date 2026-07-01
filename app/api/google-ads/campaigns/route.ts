import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getConnectedAccounts, listAccessibleCustomers, googleAdsQuery, getClientAccountIds } from '@/utils/google-ads'

const DATE_RANGE = 'LAST_30_DAYS'

const CAMPAIGN_QUERY = `
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
`

function rowToCampaign(row: any, googleAccountEmail: string, customerId: string, loginCustomerId?: string) {
  const { campaign, customer, metrics } = row
  const spend = (metrics.costMicros ?? 0) / 1_000_000
  const conversions = metrics.conversions ?? 0
  const conversionValue = metrics.conversionsValue ?? 0
  return {
    googleAccountEmail,
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
    cpi: conversions > 0 ? Math.round(spend / conversions * 100) / 100 : null,
    roas: spend > 0 ? Math.round(conversionValue / spend * 100) / 100 : null,
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

  const { searchParams } = new URL(req.url)
  const filterCustomerId = searchParams.get('customer_id')

  let accounts
  try {
    accounts = await getConnectedAccounts(user.id)
  } catch {
    return NextResponse.json({ error: 'Google Ads not connected' }, { status: 401 })
  }

  const allCampaigns: any[] = []

  await Promise.all(
    accounts.map(async ({ accessToken, googleAccountEmail }) => {
      let topLevelIds: string[]
      try {
        topLevelIds = await listAccessibleCustomers(accessToken)
      } catch {
        return
      }

      await Promise.all(
        topLevelIds.map(async (customerId) => {
          // Check if this account is a manager (MCC)
          let isManager = false
          try {
            const rows = await googleAdsQuery(accessToken, customerId, `
              SELECT customer.manager FROM customer LIMIT 1
            `)
            isManager = rows[0]?.customer?.manager ?? false
          } catch {
            return
          }

          if (!isManager) {
            // Direct client account — query campaigns without login-customer-id
            if (filterCustomerId && customerId !== filterCustomerId) return
            try {
              const rows = await googleAdsQuery(accessToken, customerId, CAMPAIGN_QUERY)
              for (const row of rows) {
                allCampaigns.push(rowToCampaign(row, googleAccountEmail, customerId))
              }
            } catch {}
            return
          }

          // Manager account — enumerate client accounts and query their campaigns
          let clientIds: string[]
          try {
            clientIds = await getClientAccountIds(accessToken, customerId)
          } catch {
            return
          }

          if (filterCustomerId) clientIds = clientIds.filter((id) => id === filterCustomerId)

          await Promise.all(
            clientIds.map(async (clientId) => {
              try {
                const rows = await googleAdsQuery(accessToken, clientId, CAMPAIGN_QUERY, customerId)
                for (const row of rows) {
                  allCampaigns.push(rowToCampaign(row, googleAccountEmail, clientId))
                }
              } catch {}
            })
          )
        })
      )
    })
  )

  allCampaigns.sort((a, b) => b.spend - a.spend)
  return NextResponse.json({ campaigns: allCampaigns, dateRange: DATE_RANGE })
}
