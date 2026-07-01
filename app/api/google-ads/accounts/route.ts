import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getConnectedAccounts, listAccessibleCustomers, googleAdsQuery, getClientAccountIds } from '@/utils/google-ads'

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

  const accountsMap = new Map<string, any>()

  await Promise.all(
    connectedAccounts.map(async ({ accessToken, googleAccountEmail }) => {
      let topLevelIds: string[]
      try {
        topLevelIds = await listAccessibleCustomers(accessToken)
      } catch {
        return
      }

      await Promise.all(
        topLevelIds.map(async (customerId) => {
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

            accountsMap.set(String(c.id), {
              googleAccountEmail,
              id: String(c.id),
              name: c.descriptiveName,
              isManager: c.manager,
              currency: c.currencyCode,
              timezone: c.timeZone,
            })

            if (!c.manager) return

            // Enumerate client accounts under this MCC
            let clientIds: string[]
            try {
              clientIds = await getClientAccountIds(accessToken, String(c.id))
            } catch {
              return
            }

            await Promise.all(
              clientIds.map(async (clientId) => {
                if (accountsMap.has(clientId)) return
                try {
                  const clientRows = await googleAdsQuery(accessToken, clientId, `
                    SELECT
                      customer.id,
                      customer.descriptive_name,
                      customer.manager,
                      customer.currency_code,
                      customer.time_zone
                    FROM customer
                    LIMIT 1
                  `, String(c.id))
                  const cc = clientRows[0]?.customer
                  if (!cc) return
                  accountsMap.set(String(cc.id), {
                    googleAccountEmail,
                    id: String(cc.id),
                    name: cc.descriptiveName,
                    isManager: cc.manager,
                    currency: cc.currencyCode,
                    timezone: cc.timeZone,
                  })
                } catch {}
              })
            )
          } catch {}
        })
      )
    })
  )

  return NextResponse.json({ accounts: [...accountsMap.values()] })
}
