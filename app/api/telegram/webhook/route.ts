import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendTelegramMessage } from '@/utils/telegram'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Telegram gọi route này cho mỗi tin nhắn gửi tới bot.
// Đăng ký một lần bằng setWebhook với secret_token — Telegram gửi lại
// secret đó trong header x-telegram-bot-api-secret-token.
// Luôn trả 200 cho update hợp lệ để Telegram không retry vô hạn.
export async function POST(req: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!secret || req.headers.get('x-telegram-bot-api-secret-token') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const update = await req.json().catch(() => null)
  const msg = update?.message
  const chatId: number | undefined = msg?.chat?.id
  const text: string = msg?.text ?? ''
  if (!chatId || !text) return NextResponse.json({ ok: true })

  if (text.startsWith('/start')) {
    const code = text.split(/\s+/)[1]
    if (!code) {
      await sendTelegramMessage(
        chatId,
        'Hi! Open the Settings page in Ad Creative AI and press "Connect Telegram" to link this chat.'
      )
      return NextResponse.json({ ok: true })
    }

    const supabase = serviceClient()
    const { data: row } = await supabase
      .from('telegram_links')
      .select('user_id')
      .eq('link_code', code)
      .maybeSingle()

    if (!row) {
      await sendTelegramMessage(
        chatId,
        '❌ Link code not found or already used. Generate a new link from the Settings page.'
      )
      return NextResponse.json({ ok: true })
    }

    await supabase
      .from('telegram_links')
      .update({
        chat_id: chatId,
        telegram_username: msg.from?.username ?? null,
        linked_at: new Date().toISOString(),
        link_code: null, // mã dùng một lần
      })
      .eq('user_id', row.user_id)

    await sendTelegramMessage(
      chatId,
      '✅ Linked! You will receive Google Ads alerts and reports here.\nSend /stop to turn notifications off.'
    )
    return NextResponse.json({ ok: true })
  }

  if (text.startsWith('/stop')) {
    await serviceClient()
      .from('telegram_links')
      .update({ chat_id: null, telegram_username: null, linked_at: null })
      .eq('chat_id', chatId)
    await sendTelegramMessage(chatId, 'Notifications disabled. Reconnect anytime from the Settings page.')
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: true })
}
