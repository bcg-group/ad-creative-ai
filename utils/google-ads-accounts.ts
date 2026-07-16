import { createClient } from '@supabase/supabase-js'
import { getConnectedAccounts, collectAccountTree } from './google-ads'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Traverses every connected Google account and mirrors the full MCC tree
// into ad_accounts. Upsert omits `tracked` so the user's toggles survive
// re-syncs; rows for accounts that disappeared are deleted only on a
// fully clean sync (any traversal error could mean a whole subtree is
// temporarily unreachable, not gone).
export async function syncUserAdAccounts(
  userId: string
): Promise<{ synced: number; removed: number; errors: string[] }> {
  const errors: string[] = []
  const accounts = await getConnectedAccounts(userId)

  const rows: any[] = []
  const seen = new Set<string>()

  for (const { accessToken, googleAccountEmail } of accounts) {
    let nodes
    try {
      nodes = await collectAccountTree(accessToken, errors)
    } catch (e: any) {
      errors.push(`[${googleAccountEmail}] collectAccountTree: ${e?.message}`)
      continue
    }
    for (const n of nodes) {
      // Same customer can be reachable from two Google logins — first wins
      if (seen.has(n.customerId)) continue
      seen.add(n.customerId)
      rows.push({
        user_id: userId,
        google_account_email: googleAccountEmail,
        customer_id: n.customerId,
        name: n.name,
        currency: n.currency,
        timezone: n.timezone,
        is_manager: n.isManager,
        status: n.status,
        parent_customer_id: n.parentCustomerId,
        login_customer_id: n.loginCustomerId,
        level: n.level,
        last_synced_at: new Date().toISOString(),
      })
    }
  }

  const supabase = serviceClient()
  let synced = 0
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500)
    const { error } = await supabase
      .from('ad_accounts')
      .upsert(chunk, { onConflict: 'user_id,customer_id' })
    if (error) errors.push(`upsert: ${error.message}`)
    else synced += chunk.length
  }

  let removed = 0
  if (rows.length > 0 && errors.length === 0) {
    const { data: existing } = await supabase
      .from('ad_accounts')
      .select('customer_id')
      .eq('user_id', userId)
    const gone = (existing ?? [])
      .map((r) => r.customer_id)
      .filter((id) => !seen.has(id))
    if (gone.length > 0) {
      const { error } = await supabase
        .from('ad_accounts')
        .delete()
        .eq('user_id', userId)
        .in('customer_id', gone)
      if (error) errors.push(`delete stale: ${error.message}`)
      else removed = gone.length
    }
  }

  return { synced, removed, errors }
}

// Customer IDs the user has toggled off — excluded from dashboard queries
// and the snapshot cron. Empty set when the table hasn't been synced yet.
export async function getUntrackedCustomerIds(userId: string): Promise<Set<string>> {
  const { data } = await serviceClient()
    .from('ad_accounts')
    .select('customer_id')
    .eq('user_id', userId)
    .eq('tracked', false)
  return new Set((data ?? []).map((r) => r.customer_id))
}
