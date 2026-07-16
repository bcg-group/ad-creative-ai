import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getConnectedAccounts, googleAdsQuery, mutateCampaignStatus } from '@/utils/google-ads'

// All campaigns for a SINGLE account (no metrics, no date range — every
// non-removed campaign with its status), queried directly via the stored
// login_customer_id so it returns in ~1s. Powers the inline campaign panel
// on /ads/accounts, including enable/pause.
const CAMPAIGN_QUERY = `
  SELECT campaign.id, campaign.name, campaign.status
  FROM campaign
  WHERE campaign.status != 'REMOVED'
  ORDER BY campaign.name
`

function supa(req: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} } }
  )
}

type Resolved =
  | { ok: true; accessToken: string; loginCustomerId: string | null; isManager: boolean }
  | { ok: false; error: string; status: number }

// Finds the access token + login-customer-id for one account the user owns.
async function resolveAccount(
  supabase: ReturnType<typeof supa>,
  userId: string,
  customerId: string
): Promise<Resolved> {
  const { data: acct } = await supabase
    .from('ad_accounts')
    .select('login_customer_id, google_account_email, is_manager')
    .eq('customer_id', customerId)
    .maybeSingle()

  if (!acct) return { ok: false, error: 'Account not synced', status: 404 }

  let accounts
  try {
    accounts = await getConnectedAccounts(userId)
  } catch {
    return { ok: false, error: 'Google Ads not connected', status: 401 }
  }
  const match = accounts.find((a) => a.googleAccountEmail === acct.google_account_email)
  if (!match) return { ok: false, error: 'Google login not connected', status: 401 }

  return {
    ok: true,
    accessToken: match.accessToken,
    loginCustomerId: acct.login_customer_id,
    isManager: acct.is_manager,
  }
}

export async function GET(req: NextRequest) {
  const supabase = supa(req)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const customerId = new URL(req.url).searchParams.get('customer_id')
  if (!customerId) return NextResponse.json({ error: 'customer_id required' }, { status: 400 })

  const acc = await resolveAccount(supabase, user.id, customerId)
  if (!acc.ok) return NextResponse.json({ error: acc.error }, { status: acc.status })
  if (acc.isManager) return NextResponse.json({ campaigns: [] })

  try {
    const rows = await googleAdsQuery(acc.accessToken, customerId, CAMPAIGN_QUERY, acc.loginCustomerId ?? undefined)
    const campaigns = rows.map((r: any) => ({
      campaignId: String(r.campaign.id),
      campaignName: r.campaign.name,
      status: r.campaign.status,
    }))
    return NextResponse.json({ campaigns })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Query failed' }, { status: 500 })
  }
}

// Enable / pause a campaign.
export async function POST(req: NextRequest) {
  const supabase = supa(req)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { customer_id: customerId, campaign_id: campaignId, status } = body
  if (!customerId || !campaignId || (status !== 'ENABLED' && status !== 'PAUSED')) {
    return NextResponse.json({ error: 'customer_id, campaign_id and status (ENABLED|PAUSED) required' }, { status: 400 })
  }

  const acc = await resolveAccount(supabase, user.id, customerId)
  if (!acc.ok) return NextResponse.json({ error: acc.error }, { status: acc.status })
  if (acc.isManager) return NextResponse.json({ error: 'Cannot mutate a manager account' }, { status: 400 })

  try {
    await mutateCampaignStatus(acc.accessToken, customerId, campaignId, status, acc.loginCustomerId ?? undefined)
    return NextResponse.json({ ok: true, status })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Mutate failed' }, { status: 500 })
  }
}
