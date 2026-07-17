import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function getUser(req: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// GET — trạng thái liên kết Telegram của user hiện tại
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await serviceClient()
    .from('telegram_links')
    .select('chat_id, telegram_username, linked_at')
    .eq('user_id', user.id)
    .maybeSingle()

  return NextResponse.json({
    linked: !!data?.chat_id,
    username: data?.telegram_username ?? null,
    botConfigured: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_USERNAME),
  })
}

// POST — sinh mã một lần và trả về deep-link t.me/<bot>?start=<code>.
// User bấm link, bot nhận /start <code> qua webhook và lưu chat_id.
export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const botUsername = process.env.TELEGRAM_BOT_USERNAME
  if (!botUsername || !process.env.TELEGRAM_BOT_TOKEN) {
    return NextResponse.json(
      { error: 'Telegram bot is not configured (TELEGRAM_BOT_TOKEN / TELEGRAM_BOT_USERNAME)' },
      { status: 500 }
    )
  }

  const code = randomBytes(16).toString('hex')
  const { error } = await serviceClient()
    .from('telegram_links')
    .upsert({ user_id: user.id, link_code: code }, { onConflict: 'user_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ url: `https://t.me/${botUsername}?start=${code}` })
}

// DELETE — hủy liên kết (giữ row để rule không mất, chỉ xóa chat)
export async function DELETE(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await serviceClient()
    .from('telegram_links')
    .update({ chat_id: null, telegram_username: null, linked_at: null, link_code: null })
    .eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
