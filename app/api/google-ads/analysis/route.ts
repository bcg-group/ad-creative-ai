import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function POST(req: NextRequest) {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { campaigns } = await req.json()
  if (!campaigns?.length) return NextResponse.json({ error: 'No campaigns provided' }, { status: 400 })

  const summary = campaigns.map((c: any) =>
    `- ${c.campaignName} (${c.accountName}): Spend=$${c.spend}, Installs=${c.conversions}, CPI=${c.cpi ?? 'N/A'}, ROAS=${c.roas ?? 'N/A'}x, CTR=${c.ctr}%, Status=${c.status}`
  ).join('\n')

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 600,
    messages: [{
      role: 'user',
      content: `You are a Google Ads performance analyst for mobile apps. Analyze the following campaigns and identify which are performing well, which are underperforming, and recommend specific actions.

Last 30 days data:
${summary}

Good benchmarks: CPI < $2, ROAS > 2x, CTR > 1%.

Reply concisely in English, maximum 5 bullet points. Format:
✅ Top campaign: [name] — short reason
❌ Underperforming: [name] — short reason
💡 Recommendation: most important action to take now`,
    }],
  })

  const analysis = message.content[0].type === 'text' ? message.content[0].text : ''
  return NextResponse.json({ analysis })
}
