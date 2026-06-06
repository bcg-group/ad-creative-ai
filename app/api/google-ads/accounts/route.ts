import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getConnectedAccounts, listAccessibleCustomers, googleAdsQuery } from '@/utils/google-ads'

export async function GET(req: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let connectedAccounts
  try {
    connectedAccounts = await getConnectedAccounts(user.id)
  } catch {
    return NextResponse.json({ error: 'Google Ads not connected' }, { status: 401 })
  }

  const allAccounts: any[] = []

  await Promise.all(
    connectedAccounts.map(async ({ accessToken, googleAccountEmail }) => {
      let customerIds: string[]
      try {
        customerIds = await listAccessibleCustomers(accessToken)
      } catch {
        return
      }

      await Promise.all(
        customerIds.map(async (customerId) => {
          try {
            const rows = await googleAdsQuery(accessToken, customerId, `
              SELECT
                customer.id,
                customer.descriptive_name,
                customer.manager,
                customer.currency_code,
                customer.time_zone
              FROM customer
              LIMIT 1
            `)
            const c = rows[0]?.customer
            if (!c) return
            allAccounts.push({
              googleAccountEmail,
              id: String(c.id),
              name: c.descriptiveName,
              isManager: c.manager,
              currency: c.currencyCode,
              timezone: c.timeZone,
            })
          } catch {}
        })
      )
    })
  )

  return NextResponse.json({ accounts: allAccounts })
}
