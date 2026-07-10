import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { snapshotUserCampaigns } from '@/utils/google-ads-snapshot'

export const maxDuration = 60

function sessionClient(req: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} } }
  )
}

// Trả về daily snapshots của user (RLS lọc theo user), mặc định 30 ngày gần nhất
export async function GET(req: NextRequest) {
  const supabase = sessionClient(req)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const days = Math.min(Number(searchParams.get('days')) || 30, 90)
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('campaign_snapshots')
    .select('customer_id, account_name, currency, campaign_id, campaign_name, status, snapshot_date, impressions, clicks, spend, conversions, conversions_value')
    .gte('snapshot_date', since)
    .order('snapshot_date', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ snapshots: data ?? [], days })
}

// Sync thủ công — backfill 30 ngày cho chính user đang đăng nhập
export async function POST(req: NextRequest) {
  const supabase = sessionClient(req)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const result = await snapshotUserCampaigns(user.id, 'LAST_30_DAYS')
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Sync failed' }, { status: 500 })
  }
}
