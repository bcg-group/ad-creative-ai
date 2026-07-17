import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { snapshotUserCampaigns } from '@/utils/google-ads-snapshot'
import { syncUserAdAccounts } from '@/utils/google-ads-accounts'
import { evaluateUserNotificationRules } from '@/utils/notification-rules'

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
  const results: Record<
    string,
    { upserted: number; notified: number; errors: string[] }
  > = {}

  // Tuần tự từng user — tránh dồn quota Google Ads API vào một thời điểm.
  // Mỗi user: snapshot số liệu → sync ad_accounts (báo Telegram khi status/
  // billing đổi) → chạy notification rules (báo cáo ROAS/spend định kỳ).
  for (const userId of userIds) {
    const errors: string[] = []
    let upserted = 0
    let notified = 0

    try {
      const snap = await snapshotUserCampaigns(userId, 'LAST_7_DAYS')
      upserted = snap.upserted
      errors.push(...snap.errors)
    } catch (e: any) {
      errors.push(`snapshot: ${e?.message ?? 'unknown error'}`)
    }

    try {
      const sync = await syncUserAdAccounts(userId)
      errors.push(...sync.errors)
    } catch (e: any) {
      errors.push(`account sync: ${e?.message ?? 'unknown error'}`)
    }

    try {
      const rules = await evaluateUserNotificationRules(userId)
      notified = rules.sent
      errors.push(...rules.errors)
    } catch (e: any) {
      errors.push(`rules: ${e?.message ?? 'unknown error'}`)
    }

    results[userId] = { upserted, notified, errors }
  }

  return NextResponse.json({ users: userIds.length, results })
}
