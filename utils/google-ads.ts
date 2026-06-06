import { createClient } from '@supabase/supabase-js'

const DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN!
const CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID!
const CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET!
const API_BASE = 'https://googleads.googleapis.com/v17'

export type GoogleAdsAccount = {
  googleAccountId: string
  googleAccountEmail: string
  accessToken: string
  refreshToken: string
  expiresAt: string
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error('Failed to refresh access token')
  return data.access_token
}

export async function getConnectedAccounts(userId: string): Promise<GoogleAdsAccount[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: tokens } = await supabase
    .from('google_ads_tokens')
    .select('google_account_id, google_account_email, access_token, refresh_token, expires_at')
    .eq('user_id', userId)

  if (!tokens || tokens.length === 0) throw new Error('No Google Ads accounts connected')

  // Refresh expired tokens in parallel
  const refreshed = await Promise.all(
    tokens.map(async (t) => {
      const isExpired = new Date(t.expires_at) <= new Date(Date.now() + 60_000)
      if (!isExpired) return { ...t, access_token: t.access_token }

      const newToken = await refreshAccessToken(t.refresh_token)
      await supabase.from('google_ads_tokens').update({
        access_token: newToken,
        expires_at: new Date(Date.now() + 3600_000).toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('user_id', userId).eq('google_account_id', t.google_account_id)

      return { ...t, access_token: newToken }
    })
  )

  return refreshed.map((t) => ({
    googleAccountId: t.google_account_id,
    googleAccountEmail: t.google_account_email,
    accessToken: t.access_token,
    refreshToken: t.refresh_token,
    expiresAt: t.expires_at,
  }))
}

export async function googleAdsQuery(
  accessToken: string,
  customerId: string,
  query: string
): Promise<any[]> {
  const cleanId = customerId.replace(/-/g, '')
  const res = await fetch(`${API_BASE}/customers/${cleanId}/googleAds:searchStream`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'developer-token': DEVELOPER_TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err?.error?.message ?? `Google Ads API error ${res.status}`)
  }

  const lines = await res.text()
  const results: any[] = []
  for (const line of lines.split('\n').filter(Boolean)) {
    try {
      const batch = JSON.parse(line)
      if (batch.results) results.push(...batch.results)
    } catch {}
  }
  return results
}

export async function listAccessibleCustomers(accessToken: string): Promise<string[]> {
  const res = await fetch(`${API_BASE}/customers:listAccessibleCustomers`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'developer-token': DEVELOPER_TOKEN,
    },
  })
  if (!res.ok) throw new Error('Failed to list accessible customers')
  const data = await res.json()
  return (data.resourceNames ?? []).map((r: string) => r.replace('customers/', ''))
}
