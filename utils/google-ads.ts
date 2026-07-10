import { createClient } from '@supabase/supabase-js'

const API_BASE = 'https://googleads.googleapis.com/v24'

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
      client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
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

  const refreshed = (await Promise.all(
    tokens.map(async (t) => {
      const isExpired = new Date(t.expires_at) <= new Date(Date.now() + 60_000)
      if (!isExpired) return { ...t, access_token: t.access_token }

      try {
        const newToken = await refreshAccessToken(t.refresh_token)
        await supabase.from('google_ads_tokens').update({
          access_token: newToken,
          expires_at: new Date(Date.now() + 3600_000).toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('user_id', userId).eq('google_account_id', t.google_account_id)
        return { ...t, access_token: newToken }
      } catch {
        // Token is invalid — remove it so connect page shows correct status
        await supabase.from('google_ads_tokens')
          .delete()
          .eq('user_id', userId)
          .eq('google_account_id', t.google_account_id)
        return null
      }
    })
  )).filter(Boolean) as typeof tokens

  if (refreshed.length === 0) throw new Error('No Google Ads accounts connected')

  return refreshed.map((t) => ({
    googleAccountId: t.google_account_id,
    googleAccountEmail: t.google_account_email,
    accessToken: t.access_token,
    refreshToken: t.refresh_token,
    expiresAt: t.expires_at,
  }))
}

function makeHeaders(accessToken: string, loginCustomerId?: string): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
    'Content-Type': 'application/json',
  }
  if (loginCustomerId) h['login-customer-id'] = loginCustomerId.replace(/-/g, '')
  return h
}

export async function googleAdsQuery(
  accessToken: string,
  customerId: string,
  query: string,
  loginCustomerId?: string
): Promise<any[]> {
  const cleanId = customerId.replace(/-/g, '')
  const res = await fetch(`${API_BASE}/customers/${cleanId}/googleAds:searchStream`, {
    method: 'POST',
    headers: makeHeaders(accessToken, loginCustomerId),
    body: JSON.stringify({ query }),
  })

  if (!res.ok) {
    const errText = await res.text()
    let message = `${res.status}: ${errText.slice(0, 800)}`
    try { message = JSON.parse(errText)?.error?.message ?? message } catch {}
    throw new Error(message)
  }

  // REST searchStream returns one JSON array of batches (not NDJSON)
  const text = await res.text()
  const results: any[] = []
  const data = JSON.parse(text)
  for (const batch of Array.isArray(data) ? data : [data]) {
    if (batch?.results) results.push(...batch.results)
  }
  return results
}

// Uses the paginated /search endpoint — more reliable for resource enumeration
async function googleAdsSearch(
  accessToken: string,
  customerId: string,
  query: string,
  loginCustomerId?: string
): Promise<any[]> {
  const cleanId = customerId.replace(/-/g, '')
  const results: any[] = []
  let pageToken: string | undefined

  do {
    const body: any = { query }
    if (pageToken) body.pageToken = pageToken

    const res = await fetch(`${API_BASE}/customers/${cleanId}/googleAds:search`, {
      method: 'POST',
      headers: makeHeaders(accessToken, loginCustomerId),
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errText = await res.text()
      let message = `${res.status}: ${errText.slice(0, 1200)}`
      try {
        const parsed = JSON.parse(errText)
        const gErr = parsed?.error?.details?.[0]?.errors?.[0]
        message = gErr
          ? `${gErr.errorCode ? JSON.stringify(gErr.errorCode) : ''} ${gErr.message ?? ''}`.trim()
          : (parsed?.error?.message ?? message)
      } catch {}
      throw new Error(message)
    }

    const data = await res.json()
    if (data.results) results.push(...data.results)
    pageToken = data.nextPageToken
  } while (pageToken)

  return results
}

export async function listAccessibleCustomers(accessToken: string): Promise<string[]> {
  const res = await fetch(`${API_BASE}/customers:listAccessibleCustomers`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`${res.status}: ${JSON.stringify(err)}`)
  }
  const data = await res.json()
  return (data.resourceNames ?? []).map((r: string) => r.replace('customers/', ''))
}

export type ClientAccount = {
  id: string
  isManager: boolean
  name: string | null
}

// Returns direct children (level 1) of a manager (MCC) account.
// Level 0 is the manager itself — must be excluded, otherwise campaign queries
// hit REQUESTED_METRICS_FOR_MANAGER on the MCC and recurse forever.
export async function getClientAccounts(
  accessToken: string,
  managerId: string,
  loginCustomerId?: string
): Promise<ClientAccount[]> {
  // Per docs: login-customer-id is optional for customer_client queries.
  // Only pass it when querying a sub-MCC through a different super-MCC.
  const effectiveLogin = loginCustomerId !== managerId ? loginCustomerId : undefined
  const rows = await googleAdsSearch(
    accessToken,
    managerId,
    `SELECT customer_client.client_customer, customer_client.level,
     customer_client.manager, customer_client.descriptive_name,
     customer_client.status, customer_client.id
     FROM customer_client
     WHERE customer_client.level = 1
       AND customer_client.status = 'ENABLED'`,
    effectiveLogin
  )
  return rows
    .map((r: any) => ({
      id: (r.customerClient?.clientCustomer ?? '').replace('customers/', ''),
      isManager: r.customerClient?.manager ?? false,
      name: r.customerClient?.descriptiveName ?? null,
    }))
    .filter((c: ClientAccount) => c.id)
}

export async function getClientAccountIds(
  accessToken: string,
  managerId: string,
  loginCustomerId?: string
): Promise<string[]> {
  const clients = await getClientAccounts(accessToken, managerId, loginCustomerId)
  return clients.map((c) => c.id)
}

// Debug: returns full customer_client rows for diagnostics
export async function debugCustomerClients(
  accessToken: string,
  managerId: string,
  loginCustomerId?: string
): Promise<any[]> {
  const effectiveLogin = loginCustomerId !== managerId ? loginCustomerId : undefined
  return googleAdsSearch(
    accessToken,
    managerId,
    `SELECT customer_client.client_customer, customer_client.level,
     customer_client.manager, customer_client.descriptive_name,
     customer_client.id
     FROM customer_client`,
    effectiveLogin
  )
}
