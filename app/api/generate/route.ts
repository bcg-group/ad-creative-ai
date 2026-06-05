import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { FREE_CREDITS_LIMIT, BILLING_ENABLED } from '@/utils/config'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

const SYSTEM_PROMPT = `You are an elite mobile app performance marketer with 10+ years managing multi-million dollar UA campaigns on Meta, TikTok, and Google UAC. You have achieved consistent sub-$1 CPIs across dozens of app categories.

Always write all ad copy in English, regardless of the app name or any other input language.

Your copy principles:
- Every word earns its place. Cut filler ruthlessly.
- Specificity beats vague claims. "Save 2 hours/day" > "Save time". "Join 4M users" > "Popular app".
- Lead with what the user GETS, not what the app IS.
- Match the platform's native language and format. TikTok copy sounds nothing like Meta copy.
- Character limits are hard constraints from the ad platforms, not suggestions.`

const TONE_INSTRUCTIONS: Record<string, string> = {
  professional:
    'Tone: Professional and trustworthy. Clear, confident, benefit-driven. No slang, no hype. Reads like a brand people can trust.',
  fun:
    'Tone: Fun and relatable. Casual language, light humor, feels like a friend recommending the app. Can use exclamation points sparingly. Avoid corporate speak.',
  aggressive:
    'Tone: Aggressive and urgent. Use FOMO, strong action verbs, bold claims. Words like "Stop wasting time", "Don\'t miss out", "Download NOW". High-pressure but not spammy.',
}

function buildAppContext(
  appName: string,
  category: string,
  targetUser: string,
  usps: string
): string {
  return [
    `App: ${appName}`,
    `Category: ${category}`,
    targetUser ? `Target user: ${targetUser}` : null,
    usps ? `Key features/USPs: ${usps}` : null,
  ]
    .filter(Boolean)
    .join('\n')
}

function buildMetaPrompt(appContext: string, tone: string): string {
  return `Generate 3 Meta (Facebook/Instagram) ad creative variants for this app:
${appContext}
${TONE_INSTRUCTIONS[tone] ?? TONE_INSTRUCTIONS.professional}

Each variant must use a DIFFERENT copywriting angle:
- Variant 1 (Pain/Solution): Open with a specific pain point the target user feels. Then position the app as the clear fix.
- Variant 2 (Aspiration/Outcome): Lead with the life improvement or desired outcome. Make them see themselves after using the app.
- Variant 3 (Curiosity/FOMO): Create intrigue. Use a number, a surprising fact, or a "what if" that makes them need to know more.

For each variant:
- primaryText: max 125 characters. Hook in the first 5 words. No emojis unless they add meaning.
- headline: max 40 characters. Benefit-first. Reads well as a standalone sentence.
- description: max 30 characters. Add a detail that reinforces the headline.
- cta: choose the best fit from [Download Now, Learn More, Get Started, Try for Free, Install Now]

Return ONLY valid JSON, no markdown, no explanation:
{
  "platform": "meta",
  "variants": [
    { "primaryText": "...", "headline": "...", "description": "...", "cta": "..." },
    { "primaryText": "...", "headline": "...", "description": "...", "cta": "..." },
    { "primaryText": "...", "headline": "...", "description": "...", "cta": "..." }
  ]
}`
}

function buildTikTokPrompt(appContext: string, tone: string): string {
  return `Generate 3 TikTok ad copy variants for this app:
${appContext}
${TONE_INSTRUCTIONS[tone] ?? TONE_INSTRUCTIONS.professional}

Write like a real user sharing a discovery, not a brand advertising. Lowercase is fine. Gen Z/millennial tone.

Each variant must use a DIFFERENT hook formula:
- Variant 1 (POV/Relatable): Start with "POV: you..." or "When you..." — drop the viewer into a relatable moment.
- Variant 2 (Pattern Interrupt): Start with "Stop [doing X]" or "I can't believe I [wasted X time] before finding this" — break the scroll.
- Variant 3 (Proof/Discovery): Start with a specific result, number, or "This [category] app actually [did X]" — lead with credibility.

For each variant:
- hook: the first line (3 seconds) — must stop the scroll. No setup. Pure hook.
- body: max 100 characters. Deliver the payoff. Conversational, no corporate speak.
- hashtags: 4-5 hashtags — mix niche (specific to app category) and broad (appname, viral potential). Return without # prefix.

Return ONLY valid JSON, no markdown, no explanation:
{
  "platform": "tiktok",
  "variants": [
    { "hook": "...", "body": "...", "hashtags": ["...", "...", "...", "..."] },
    { "hook": "...", "body": "...", "hashtags": ["...", "...", "...", "..."] },
    { "hook": "...", "body": "...", "hashtags": ["...", "...", "...", "..."] }
  ]
}`
}

function buildGooglePrompt(appContext: string, tone: string): string {
  return `Generate Google App Campaign (UAC) ad assets for this app:
${appContext}
${TONE_INSTRUCTIONS[tone] ?? TONE_INSTRUCTIONS.professional}

CRITICAL: Google WILL REJECT any headline over 30 characters. Count every character including spaces before writing.

Write 5 headlines covering these different angles (Google mixes them algorithmically — variety is required):
1. Feature-focused: highlight the app's standout capability
2. Benefit-focused: the outcome the user gets
3. Social proof: user count, rating, or rank (use realistic numbers or "Top Rated")
4. Free/value: e.g. "Free Download", "Free to Play"
5. Action-oriented: strong verb + direct benefit

Write 3 descriptions (max 90 characters each):
1. Problem → solution framing
2. Feature list with concrete benefits
3. Urgency or outcome-focused

Return ONLY valid JSON, no markdown, no explanation:
{
  "platform": "google",
  "variants": [
    {
      "headlines": ["...", "...", "...", "...", "..."],
      "descriptions": ["...", "...", "..."]
    }
  ]
}`
}

function buildPrompt(
  platform: string,
  tone: string,
  appName: string,
  category: string,
  targetUser: string,
  usps: string
): string {
  const appContext = buildAppContext(appName, category, targetUser, usps)
  if (platform === 'meta') return buildMetaPrompt(appContext, tone)
  if (platform === 'tiktok') return buildTikTokPrompt(appContext, tone)
  return buildGooglePrompt(appContext, tone)
}

export async function POST(req: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: () => {},
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single()

  let creditsUsed = 0
  if (BILLING_ENABLED && profile?.plan === 'free') {
    const { count } = await supabase
      .from('generations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
    creditsUsed = count ?? 0
    if (creditsUsed >= FREE_CREDITS_LIMIT) {
      return NextResponse.json(
        { error: `You've used all ${FREE_CREDITS_LIMIT} free credits. Upgrade to Pro for unlimited generates.` },
        { status: 429 }
      )
    }
  }

  const {
    appName,
    category,
    platform = 'meta',
    tone = 'professional',
    targetUser = '',
    usps = '',
  } = await req.json()

  if (!appName || !category) {
    return NextResponse.json({ error: 'appName and category are required' }, { status: 400 })
  }

  const message = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: buildPrompt(platform, tone, appName, category, targetUser, usps),
      },
    ],
  })

  const content = message.content[0]
  const text = content.type === 'text' ? content.text : ''

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
  }

  try {
    const result = JSON.parse(jsonMatch[0])

    await supabase.from('generations').insert({
      user_id: user.id,
      app_name: appName,
      category,
      platform,
      tone,
      target_user: targetUser || null,
      usps: usps || null,
      result,
    })

    const usage = profile?.plan === 'free'
      ? { plan: 'free', creditsUsed: creditsUsed + 1, creditsTotal: FREE_CREDITS_LIMIT }
      : { plan: profile?.plan ?? 'free' }

    return NextResponse.json({ result, usage })
  } catch {
    return NextResponse.json({ error: 'Invalid JSON from AI' }, { status: 500 })
  }
}
