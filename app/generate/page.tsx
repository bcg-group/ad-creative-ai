'use client'

import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/client'
import { FREE_CREDITS_LIMIT, BILLING_ENABLED } from '@/utils/config'

const CATEGORIES = [
  'Gaming',
  'Utility',
  'Finance',
  'Health & Fitness',
  'Education',
  'Shopping',
  'Social',
  'Travel',
  'Food & Drink',
  'Other',
]

const PLATFORMS = [
  { id: 'meta', label: 'Meta', sub: 'Facebook / Instagram' },
  { id: 'tiktok', label: 'TikTok', sub: 'Short-form video' },
  { id: 'google', label: 'Google', sub: 'App campaigns' },
]

const TONES = [
  {
    id: 'professional',
    label: 'Professional',
    sub: 'Credible & trustworthy',
    active: 'border-slate-500 bg-slate-50 text-slate-700',
  },
  {
    id: 'fun',
    label: 'Fun',
    sub: 'Playful & relatable',
    active: 'border-purple-500 bg-purple-50 text-purple-700',
  },
  {
    id: 'aggressive',
    label: 'Aggressive',
    sub: 'Urgent & bold',
    active: 'border-orange-500 bg-orange-50 text-orange-700',
  },
]

type MetaVariant = {
  primaryText: string
  headline: string
  description: string
  cta: string
}

type TikTokVariant = {
  hook: string
  body: string
  hashtags: string[]
}

type GoogleVariant = {
  headlines: string[]
  descriptions: string[]
}

type Variant = MetaVariant | TikTokVariant | GoogleVariant

type AdResult = {
  platform: string
  variants: Variant[]
}

export default function Home() {
  const [appName, setAppName] = useState('')
  const [category, setCategory] = useState('')
  const [platform, setPlatform] = useState('meta')
  const [tone, setTone] = useState('professional')
  const [targetUser, setTargetUser] = useState('')
  const [usps, setUsps] = useState('')
  const [result, setResult] = useState<AdResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [creditsUsed, setCreditsUsed] = useState<number | null>(null)
  const [userPlan, setUserPlan] = useState<string | null>(null)

  const [urlInput, setUrlInput] = useState('')
  const [urlLoading, setUrlLoading] = useState(false)
  const [urlError, setUrlError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) return
    const supabase = createClient()
    Promise.all([
      supabase.from('profiles').select('plan').eq('id', user.id).single(),
      supabase.from('generations').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    ]).then(([profileRes, countRes]) => {
      setUserPlan(profileRes.data?.plan ?? 'free')
      setCreditsUsed(countRes.count ?? 0)
    })
  }, [user])

  const handleSignOut = async () => {
    await createClient().auth.signOut()
  }

  const handleUpgrade = async () => {
    const res = await fetch('/api/stripe/checkout', { method: 'POST' })
    const data = await res.json()
    if (data.url) window.location.href = data.url
  }

  const handleResetCredits = async () => {
    const res = await fetch('/api/dev/reset-credits', { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      setCreditsUsed(0)
      setError('')
    } else {
      alert(`Reset failed: ${data.error}`)
    }
  }

  const handleManagePlan = async () => {
    const res = await fetch('/api/stripe/portal', { method: 'POST' })
    const data = await res.json()
    if (data.url) window.location.href = data.url
  }

  const handleExtractFromUrl = async () => {
    if (!urlInput.trim()) return
    setUrlLoading(true)
    setUrlError('')
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to extract')
      if (data.appName) setAppName(data.appName)
      if (data.category && CATEGORIES.includes(data.category)) setCategory(data.category)
      if (data.targetUser) setTargetUser(data.targetUser)
      if (data.usps) setUsps(data.usps)
      setUrlInput('')
    } catch (err) {
      setUrlError(err instanceof Error ? err.message : 'Could not read the URL.')
    } finally {
      setUrlLoading(false)
    }
  }

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const exportCsv = () => {
    if (!result) return

    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
    let rows: string[][] = []

    if (result.platform === 'meta') {
      rows = [['Variant', 'Primary Text', 'Headline', 'Description', 'CTA']]
      result.variants.forEach((v, i) => {
        const mv = v as MetaVariant
        rows.push([String(i + 1), mv.primaryText ?? '', mv.headline ?? '', mv.description ?? '', mv.cta ?? ''])
      })
    } else if (result.platform === 'tiktok') {
      rows = [['Variant', 'Hook', 'Body', 'Hashtags']]
      result.variants.forEach((v, i) => {
        const tv = v as TikTokVariant
        rows.push([String(i + 1), tv.hook ?? '', tv.body ?? '', tv.hashtags?.map((h) => `#${h}`).join(' ') ?? ''])
      })
    } else {
      const gv = result.variants[0] as GoogleVariant
      const hCount = gv.headlines?.length ?? 0
      const dCount = gv.descriptions?.length ?? 0
      rows = [[
        ...Array.from({ length: hCount }, (_, i) => `Headline ${i + 1}`),
        ...Array.from({ length: dCount }, (_, i) => `Description ${i + 1}`),
      ]]
      rows.push([...(gv.headlines ?? []), ...(gv.descriptions ?? [])])
    }

    const csv = rows.map((r) => r.map(esc).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${appName}-${result.platform}-ads.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const copyAll = () => {
    if (!result) return
    const text = result.variants
      .map((v, i) => {
        const lines = [`--- Variant ${i + 1} ---`]
        const mv = v as MetaVariant
        const tv = v as TikTokVariant
        const gv = v as GoogleVariant
        if (mv.primaryText) lines.push(`Primary Text: ${mv.primaryText}`)
        if (mv.headline) lines.push(`Headline: ${mv.headline}`)
        if (mv.description) lines.push(`Description: ${mv.description}`)
        if (mv.cta) lines.push(`CTA: ${mv.cta}`)
        if (tv.hook) lines.push(`Hook: ${tv.hook}`)
        if (tv.body) lines.push(`Body: ${tv.body}`)
        if (tv.hashtags) lines.push(`Hashtags: ${tv.hashtags.map((h) => `#${h}`).join(' ')}`)
        if (gv.headlines) lines.push(`Headlines:\n${gv.headlines.map((h, j) => `  ${j + 1}. ${h}`).join('\n')}`)
        if (gv.descriptions) lines.push(`Descriptions:\n${gv.descriptions.map((d, j) => `  ${j + 1}. ${d}`).join('\n')}`)
        return lines.join('\n')
      })
      .join('\n\n')
    copyText(text, 'all')
  }

  const handleGenerate = async () => {
    if (!user) {
      window.location.href = '/login'
      return
    }
    if (!appName.trim() || !category) {
      setError('Please fill in App Name and Category.')
      return
    }
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appName, category, platform, tone, targetUser, usps }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? 'Something went wrong.')
      if (data.usage?.creditsUsed !== undefined) setCreditsUsed(data.usage.creditsUsed)
      if (data.usage?.plan) setUserPlan(data.usage.plan)
      setResult(data.result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const platformLabel = PLATFORMS.find((p) => p.id === platform)?.label ?? platform

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <a href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">Ad</span>
            </div>
            <span className="text-xl font-semibold text-gray-900">Ad Creative AI</span>
          </a>
          <span className="text-sm text-gray-400">for mobile apps</span>
          <div className="ml-auto flex items-center gap-3">
            {!authLoading && user && (
              <>
                <a href="/history" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
                  History
                </a>
                <a href="/ads" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
                  Ads Manager
                </a>
              </>
            )}
            {!authLoading && (
              user ? (
                <>
                  {user.user_metadata?.avatar_url && (
                    <img
                      src={user.user_metadata.avatar_url}
                      alt=""
                      className="w-7 h-7 rounded-full"
                    />
                  )}
                  <span className="text-sm text-gray-700 hidden sm:block">
                    {user.user_metadata?.full_name ?? user.email}
                  </span>
                  {BILLING_ENABLED && userPlan === 'pro' ? (
                    <>
                      <span className="text-xs font-semibold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">Pro</span>
                      <button
                        onClick={handleManagePlan}
                        className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        Manage Plan
                      </button>
                    </>
                  ) : null}
                  <button
                    onClick={handleSignOut}
                    className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <a
                  href="/login"
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                >
                  Sign in
                </a>
              )
            )}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col lg:flex-row gap-8">
        {/* LEFT: Form */}
        <div className="w-full lg:w-96 flex-shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Your App</h2>
              <p className="text-sm text-gray-500 mt-0.5">Fill in details to generate ad copy</p>
            </div>

            {/* Auto-fill from URL */}
            <div className="pb-1 border-b border-gray-100">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Auto-fill from URL
                <span className="text-gray-400 font-normal ml-1">(Play Store, App Store, or website)</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => { setUrlInput(e.target.value); setUrlError('') }}
                  onKeyDown={(e) => e.key === 'Enter' && handleExtractFromUrl()}
                  placeholder="https://play.google.com/store/apps/..."
                  className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={handleExtractFromUrl}
                  disabled={urlLoading || !urlInput.trim()}
                  className="flex-shrink-0 px-3 py-2 bg-gray-900 hover:bg-gray-700 disabled:bg-gray-300 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
                >
                  {urlLoading ? (
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  )}
                  Fill
                </button>
              </div>
              {urlError && (
                <p className="mt-1.5 text-xs text-red-600">{urlError}</p>
              )}
            </div>

            {/* App Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                App Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                placeholder="e.g. Duolingo, Candy Crush"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Select category...</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Platform */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Platform</label>
              <div className="grid grid-cols-3 gap-2">
                {PLATFORMS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPlatform(p.id)}
                    className={`flex flex-col items-center p-2.5 rounded-lg border text-center transition-all ${
                      platform === p.id
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                    }`}
                  >
                    <span className="text-xs font-semibold">{p.label}</span>
                    <span className="text-[10px] text-gray-400 leading-tight mt-0.5">{p.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Tone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tone</label>
              <div className="grid grid-cols-3 gap-2">
                {TONES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTone(t.id)}
                    className={`flex flex-col items-center p-2.5 rounded-lg border text-center transition-all ${
                      tone === t.id
                        ? t.active
                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                    }`}
                  >
                    <span className="text-xs font-semibold">{t.label}</span>
                    <span className="text-[10px] text-gray-400 leading-tight mt-0.5">{t.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Target User */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Target User{' '}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={targetUser}
                onChange={(e) => setTargetUser(e.target.value)}
                placeholder="e.g. Casual gamers aged 18-35"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* USPs */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Key Features / USPs{' '}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={usps}
                onChange={(e) => setUsps(e.target.value)}
                placeholder="e.g. Free to play, 500+ levels, offline mode, no ads"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            <button
              onClick={handleGenerate}
              disabled={loading || authLoading || (BILLING_ENABLED && userPlan === 'free' && (creditsUsed ?? 0) >= FREE_CREDITS_LIMIT)}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Generating...
                </>
              ) : (BILLING_ENABLED && userPlan === 'free' && (creditsUsed ?? 0) >= FREE_CREDITS_LIMIT) ? (
                'No Credits Left'
              ) : user ? (
                'Generate Ad Copy'
              ) : (
                'Sign in to Generate'
              )}
            </button>
          {BILLING_ENABLED && user && userPlan === 'free' && creditsUsed !== null && (
            <div className="flex items-center justify-between text-xs">
              <span className={creditsUsed >= FREE_CREDITS_LIMIT ? 'text-red-500 font-medium' : 'text-gray-400'}>
                {creditsUsed}/{FREE_CREDITS_LIMIT} free credits used
              </span>
              <div className="flex items-center gap-2">
                {process.env.NODE_ENV === 'development' && (
                  <button
                    onClick={handleResetCredits}
                    className="text-gray-400 hover:text-gray-600 font-medium border border-dashed border-gray-300 px-1.5 py-0.5 rounded"
                  >
                    Reset (dev)
                  </button>
                )}
                {creditsUsed >= FREE_CREDITS_LIMIT - 1 && (
                  <button
                    onClick={handleUpgrade}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Upgrade to Pro →
                  </button>
                )}
              </div>
            </div>
          )}
          </div>
        </div>

        {/* RIGHT: Results */}
        <div className="flex-1 min-w-0">
          {!result && !loading && (
            <div className="flex flex-col items-center justify-center h-64 text-center text-gray-400">
              <svg
                className="w-12 h-12 mb-3 opacity-30"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
              <p className="font-medium">Results will appear here</p>
              <p className="text-sm mt-1">Fill in your app details and click Generate</p>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <svg
                className="animate-spin h-8 w-8 text-blue-500"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <p className="text-gray-500 text-sm">
                Generating {platformLabel} ad copy...
              </p>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  {result.variants.length} Variants &mdash; {platformLabel}
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={copyAll}
                    className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    {copied === 'all' ? '✓ Copied!' : 'Copy All'}
                  </button>
                  <button
                    onClick={exportCsv}
                    className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Export CSV
                  </button>
                </div>
              </div>

              {result.variants.map((variant, i) => (
                <VariantCard
                  key={i}
                  variant={variant}
                  index={i}
                  platform={result.platform}
                  onCopy={copyText}
                  copied={copied}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function VariantCard({
  variant,
  index,
  platform,
  onCopy,
  copied,
}: {
  variant: Variant
  index: number
  platform: string
  onCopy: (text: string, id: string) => void
  copied: string | null
}) {
  const mv = variant as MetaVariant
  const tv = variant as TikTokVariant
  const gv = variant as GoogleVariant

  type Field = { label: string; value: string; maxChars?: number }

  let fields: Field[] = []
  let copyableText = ''

  if (platform === 'meta') {
    fields = [
      { label: 'Primary Text', value: mv.primaryText ?? '', maxChars: 125 },
      { label: 'Headline', value: mv.headline ?? '', maxChars: 40 },
      { label: 'Description', value: mv.description ?? '', maxChars: 30 },
      { label: 'CTA', value: mv.cta ?? '' },
    ]
    copyableText = fields.map((f) => `${f.label}: ${f.value}`).join('\n')
  } else if (platform === 'tiktok') {
    fields = [
      { label: 'Hook (3s)', value: tv.hook ?? '' },
      { label: 'Body', value: tv.body ?? '', maxChars: 100 },
      { label: 'Hashtags', value: tv.hashtags?.map((h) => `#${h}`).join(' ') ?? '' },
    ]
    copyableText = fields.map((f) => `${f.label}: ${f.value}`).join('\n')
  } else {
    fields = [
      { label: 'Headlines', value: gv.headlines?.map((h, j) => `${j + 1}. ${h}`).join('\n') ?? '' },
      {
        label: 'Descriptions',
        value: gv.descriptions?.map((d, j) => `${j + 1}. ${d}`).join('\n') ?? '',
      },
    ]
    copyableText = fields.map((f) => `${f.label}:\n${f.value}`).join('\n\n')
  }

  const copyId = `v${index}`

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold text-gray-700">Variant {index + 1}</span>
        <button
          onClick={() => onCopy(copyableText, copyId)}
          className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-2.5 py-1 rounded-md transition-colors"
        >
          {copied === copyId ? '✓ Copied' : 'Copy'}
        </button>
      </div>

      <div className="space-y-4">
        {fields
          .filter((f) => f.value)
          .map((f) => (
            <div key={f.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {f.label}
                </span>
                {f.maxChars && (
                  <span
                    className={`text-xs tabular-nums ${
                      f.value.length > f.maxChars ? 'text-red-500 font-medium' : 'text-gray-400'
                    }`}
                  >
                    {f.value.length}/{f.maxChars}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-800 whitespace-pre-line leading-relaxed">{f.value}</p>
            </div>
          ))}
      </div>
    </div>
  )
}
