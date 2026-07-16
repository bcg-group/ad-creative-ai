import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { syncUserAdAccounts } from '@/utils/google-ads-accounts'

// POST — re-sync the ad_accounts table from the Google Ads API.
// Reads go straight to Supabase from the client (RLS).
export async function POST(req: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const result = await syncUserAdAccounts(user.id)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Google Ads not connected' }, { status: 401 })
  }
}
