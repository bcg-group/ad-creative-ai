import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { snapshotUserCampaigns } from '@/utils/google-ads-snapshot'

export const maxDuration = 300

// Vercel Cron gọi route này mỗi sáng (xem vercel.json).
// Bảo vệ bằng CRON_SECRET — Vercel tự gửi "Authorization: Bearer <CRON_SECRET>".
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: tokens, error } = await supabase
    .from('google_ads_tokens')
    .select('user_id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const userIds = [...new Set((tokens ?? []).map((t) => t.user_id))]
  const results: Record<string, { upserted: number; errors: string[] }> = {}

  // Tuần tự từng user — tránh dồn quota Google Ads API vào một thời điểm
  for (const userId of userIds) {
    try {
      results[userId] = await snapshotUserCampaigns(userId, 'LAST_7_DAYS')
    } catch (e: any) {
      results[userId] = { upserted: 0, errors: [e?.message ?? 'unknown error'] }
    }
  }

  return NextResponse.json({ users: userIds.length, results })
}
