import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { syncUserAdAccounts } from '@/utils/google-ads-accounts'

export const maxDuration = 300

// Check nhanh trạng thái account (suspended / billing đổi → bắn Telegram).
// Không chạy snapshot số liệu hay notification rules — việc đó vẫn thuộc
// cron sáng /api/cron/snapshot. Route này được GitLab CI schedule (hoặc
// dịch vụ cron ngoài) gọi thường xuyên hơn, bảo vệ bằng CRON_SECRET.
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
  const results: Record<string, { synced: number; errors: string[] }> = {}

  for (const userId of userIds) {
    try {
      const { synced, errors: syncErrors } = await syncUserAdAccounts(userId)
      results[userId] = { synced, errors: syncErrors }
    } catch (e: any) {
      results[userId] = { synced: 0, errors: [e?.message ?? 'unknown error'] }
    }
  }

  return NextResponse.json({ users: userIds.length, results })
}
