import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'


async function fetchPageContent(url: string): Promise<string> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(10000),
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  })

  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const html = await res.text()

  // Pull out structured meta tags first (most reliable)
  const get = (pattern: RegExp) => pattern.exec(html)?.[1]?.trim() ?? ''

  const title = get(/<title[^>]*>([^<]*)<\/title>/i)
  const metaDesc = get(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)
    || get(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i)
  const ogTitle = get(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i)
    || get(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:title["']/i)
  const ogDesc = get(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i)
    || get(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:description["']/i)

  // Strip scripts/styles then collapse whitespace for body text
  const bodyText = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .slice(0, 4000)

  return [
    title && `Title: ${title}`,
    ogTitle && `OG Title: ${ogTitle}`,
    metaDesc && `Meta Description: ${metaDesc}`,
    ogDesc && `OG Description: ${ogDesc}`,
    `Page text: ${bodyText}`,
  ]
    .filter(Boolean)
    .join('\n')
}

export async function POST(req: NextRequest) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const { url } = await req.json()

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 })
  }

  let pageContent: string
  try {
    pageContent = await fetchPageContent(url)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: `Could not fetch the URL: ${msg}. Try a direct app store link.` },
      { status: 422 }
    )
  }

  const message = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 400,
    messages: [
      {
        role: 'user',
        content: `Extract mobile app information from this page. Return ONLY valid JSON with these exact fields:
- appName: the app's name (string)
- category: best match from exactly these options: Gaming, Utility, Finance, Health & Fitness, Education, Shopping, Social, Travel, Food & Drink, Other
- targetUser: 1-sentence description of the ideal user, or empty string if unclear
- usps: comma-separated key features/selling points, or empty string if unclear

Page content:
${pageContent}

Return ONLY JSON, no markdown, no explanation:
{"appName": "...", "category": "...", "targetUser": "...", "usps": "..."}`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return NextResponse.json({ error: 'Could not extract app info from page' }, { status: 500 })
  }

  try {
    const data = JSON.parse(jsonMatch[0])
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Invalid response from AI' }, { status: 500 })
  }
}
