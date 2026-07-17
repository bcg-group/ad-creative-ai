import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getLinkedChatId, sendTelegramMessage } from '@/utils/telegram'

// POST — gửi tin nhắn thử tới chat đã liên kết của user hiện tại
export async function POST(req: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const chatId = await getLinkedChatId(user.id)
  if (!chatId) return NextResponse.json({ error: 'Telegram is not linked' }, { status: 400 })

  const ok = await sendTelegramMessage(
    chatId,
    '🔔 Test notification from Ad Creative AI — Telegram alerts are working.'
  )
  if (!ok) return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
