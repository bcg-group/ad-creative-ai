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

function rowToCampaign(row: any, googleAccountEmail: string, customerId: string) {
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
  const debugErrors: string[] = []

  await Promise.all(
    accounts.map(async ({ accessToken, googleAccountEmail }) => {
      let topLevelIds: string[]
      try {
        topLevelIds = await listAccessibleCustomers(accessToken)
      } catch (e: any) {
        debugErrors.push(`[${googleAccountEmail}] listAccessibleCustomers: ${e?.message}`)
        return
      }

      // loginId is always the top-level MCC — stays fixed through recursion
      const processAsManager = async (managerId: string, loginId: string) => {
        let clientIds: string[]
        try {
          clientIds = await getClientAccountIds(accessToken, managerId, loginId)
        } catch (e: any) {
          debugErrors.push(`[${managerId}] getClientAccountIds: ${e?.message}`)
          return
        }

        if (clientIds.length === 0) {
          debugErrors.push(`[${managerId}] manager has no client accounts`)
          return
        }

        if (filterCustomerId) clientIds = clientIds.filter((id) => id === filterCustomerId)

        await Promise.all(
          clientIds.map(async (clientId) => {
            try {
              const rows = await googleAdsQuery(accessToken, clientId, CAMPAIGN_QUERY, loginId)
              for (const row of rows) {
                allCampaigns.push(rowToCampaign(row, googleAccountEmail, clientId))
              }
            } catch (e: any) {
              if (String(e?.message).includes('REQUESTED_METRICS_FOR_MANAGER')) {
                // clientId is itself a sub-MCC — recurse with same top-level loginId
                await processAsManager(clientId, loginId)
              } else {
                debugErrors.push(`[${clientId}] campaigns via MCC ${managerId}: ${e?.message}`)
              }
            }
          })
        )
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
          } catch (e: any) {
            if (String(e?.message).includes('CUSTOMER_NOT_ENABLED')) {
              // Deactivated account — skip silently
              return
            }
            debugErrors.push(`[${customerId}] customer.manager check: ${e?.message}`)
            return
          }

          if (!isManager) {
            if (filterCustomerId && customerId !== filterCustomerId) return
            try {
              const rows = await googleAdsQuery(accessToken, customerId, CAMPAIGN_QUERY)
              for (const row of rows) {
                allCampaigns.push(rowToCampaign(row, googleAccountEmail, customerId))
              }
            } catch (e: any) {
              if (String(e?.message).includes('REQUESTED_METRICS_FOR_MANAGER')) {
                // customer.manager check said false but Google Ads treats this as a
                // manager account for metrics purposes — retry by enumerating clients.
                await processAsManager(customerId, customerId)
              } else {
                debugErrors.push(`[${customerId}] campaigns query: ${e?.message}`)
              }
            }
            return
          }

          // Manager account — enumerate client accounts
          await processAsManager(customerId, customerId)
        })
      )
    })
  )

  allCampaigns.sort((a, b) => b.spend - a.spend)
  return NextResponse.json({ campaigns: allCampaigns, dateRange: DATE_RANGE, debugErrors })
}
