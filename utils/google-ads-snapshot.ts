import { createClient } from '@supabase/supabase-js'
import { getConnectedAccounts, collectLeafAccounts, googleAdsQuery } from './google-ads'
import { getUntrackedCustomerIds } from './google-ads-accounts'

export type SnapshotRange = 'LAST_7_DAYS' | 'LAST_30_DAYS'

// Daily breakdown — one row per campaign per day
const dailyQuery = (dateRange: SnapshotRange) => `
  SELECT
    campaign.id,
    campaign.name,
    campaign.status,
    customer.descriptive_name,
    customer.currency_code,
    segments.date,
    metrics.impressions,
    metrics.clicks,
    metrics.cost_micros,
    metrics.conversions,
    metrics.conversions_value
  FROM campaign
  WHERE campaign.status != 'REMOVED'
    AND segments.date DURING ${dateRange}
`

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Fetches daily campaign metrics for every account the user connected and
// upserts them into campaign_snapshots. Re-running overwrites the same
// (campaign, date) rows, which also backfills late-attributed conversions.
export async function snapshotUserCampaigns(
  userId: string,
  dateRange: SnapshotRange = 'LAST_7_DAYS'
): Promise<{ upserted: number; errors: string[] }> {
  const errors: string[] = []
  const rows: any[] = []

  const accounts = await getConnectedAccounts(userId)
  const untracked = await getUntrackedCustomerIds(userId)

  for (const { accessToken, googleAccountEmail } of accounts) {
    let leaves
    try {
      leaves = await collectLeafAccounts(accessToken, errors)
    } catch (e: any) {
      errors.push(`[${googleAccountEmail}] collectLeafAccounts: ${e?.message}`)
      continue
    }
    leaves = leaves.filter((l) => !untracked.has(l.customerId))

    for (let i = 0; i < leaves.length; i += 5) {
      await Promise.all(
        leaves.slice(i, i + 5).map(async ({ customerId, loginId }) => {
          try {
            const results = await googleAdsQuery(accessToken, customerId, dailyQuery(dateRange), loginId)
            for (const r of results) {
              const { campaign, customer, metrics, segments } = r
              rows.push({
                user_id: userId,
                google_account_email: googleAccountEmail,
                customer_id: customerId,
                account_name: customer.descriptiveName ?? null,
                currency: customer.currencyCode ?? null,
                campaign_id: String(campaign.id),
                campaign_name: campaign.name,
                status: campaign.status,
                snapshot_date: segments.date,
                impressions: Number(metrics.impressions ?? 0),
                clicks: Number(metrics.clicks ?? 0),
                spend: Math.round(Number(metrics.costMicros ?? 0) / 10_000) / 100,
                conversions: Math.round(Number(metrics.conversions ?? 0) * 100) / 100,
                conversions_value: Math.round(Number(metrics.conversionsValue ?? 0) * 100) / 100,
                updated_at: new Date().toISOString(),
              })
            }
          } catch (e: any) {
            errors.push(`[${customerId}] daily query: ${e?.message}`)
          }
        })
      )
    }
  }

  const supabase = serviceClient()
  let upserted = 0
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500)
    const { error } = await supabase
      .from('campaign_snapshots')
      .upsert(chunk, { onConflict: 'user_id,customer_id,campaign_id,snapshot_date' })
    if (error) errors.push(`upsert: ${error.message}`)
    else upserted += chunk.length
  }

  return { upserted, errors }
}
