import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}/ads/connect?error=access_denied`)
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${appUrl}/login`)
  }

  const clientId = process.env.GOOGLE_ADS_CLIENT_ID!
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET!
  const redirectUri = `${appUrl}/api/google-ads/callback`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  const tokens = await tokenRes.json()

  if (!tokenRes.ok || !tokens.access_token) {
    return NextResponse.redirect(`${appUrl}/ads/connect?error=token_exchange_failed`)
  }

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

  await supabase.from('google_ads_tokens').upsert({
    user_id: user.id,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: expiresAt,
    scope: tokens.scope,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })

  return NextResponse.redirect(`${appUrl}/ads/dashboard?connected=true`)
}
