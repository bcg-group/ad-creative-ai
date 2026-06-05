'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

type MetaVariant = { primaryText: string; headline: string; description: string; cta: string }
type TikTokVariant = { hook: string; body: string; hashtags: string[] }
type GoogleVariant = { headlines: string[]; descriptions: string[] }
type Variant = MetaVariant | TikTokVariant | GoogleVariant
type AdResult = { platform: string; variants: Variant[] }

type Generation = {
  id: string
  app_name: string
  category: string
  platform: string
  tone: string
  result: AdResult
  created_at: string
}

const PLATFORM_COLORS: Record<string, string> = {
  meta: 'bg-blue-100 text-blue-700',
  tiktok: 'bg-pink-100 text-pink-700',
  google: 'bg-green-100 text-green-700',
}

export default function HistoryPage() {
  const router = useRouter()
  const [generations, setGenerations] = useState<Generation[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      supabase
        .from('generations')
        .select('id, app_name, category, platform, tone, result, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)
        .then(({ data }) => {
          setGenerations(data ?? [])
          setLoading(false)
        })
    })
  }, [router])

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <a href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">Ad</span>
            </div>
            <span className="text-xl font-semibold text-gray-900">Ad Creative AI</span>
          </a>
          <span className="text-gray-200 mx-1">|</span>
          <span className="text-sm text-gray-500">History</span>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Generation History</h1>
          <a
            href="/"
            className="text-sm font-medium text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-300 px-3 py-1.5 rounded-lg transition-colors"
          >
            + New generation
          </a>
        </div>

        {loading && (
          <div className="flex justify-center py-20">
            <svg className="animate-spin h-6 w-6 text-blue-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}

        {!loading && generations.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            <svg className="w-10 h-10 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="font-medium">No generations yet</p>
            <p className="text-sm mt-1">Your ad copy generations will appear here</p>
          </div>
        )}

        {!loading && generations.length > 0 && (
          <div className="space-y-2">
            {generations.map((gen) => (
              <div key={gen.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setExpanded(expanded === gen.id ? null : gen.id)}
                  className="w-full px-5 py-4 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{gen.app_name}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PLATFORM_COLORS[gen.platform] ?? 'bg-gray-100 text-gray-600'}`}>
                        {gen.platform.charAt(0).toUpperCase() + gen.platform.slice(1)}
                      </span>
                      <span className="text-xs text-gray-400 capitalize">{gen.tone}</span>
                      <span className="text-xs text-gray-300">·</span>
                      <span className="text-xs text-gray-400">{gen.category}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-gray-400">
                      {new Date(gen.created_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}
                    </span>
                    <svg
                      className={`h-4 w-4 text-gray-400 transition-transform ${expanded === gen.id ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {expanded === gen.id && (
                  <div className="border-t border-gray-100 px-5 py-4 space-y-3">
                    {gen.result?.variants?.map((variant, i) => (
                      <VariantSummary key={i} variant={variant} index={i} platform={gen.platform} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function VariantSummary({
  variant,
  index,
  platform,
}: {
  variant: Variant
  index: number
  platform: string
}) {
  const mv = variant as MetaVariant
  const tv = variant as TikTokVariant
  const gv = variant as GoogleVariant

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Variant {index + 1}</p>

      {platform === 'meta' && (
        <div className="space-y-2.5 text-sm">
          <Field label="Primary Text" value={mv.primaryText} />
          <Field label="Headline" value={mv.headline} />
          <div className="flex gap-6">
            <Field label="Description" value={mv.description} />
            <Field label="CTA" value={mv.cta} />
          </div>
        </div>
      )}

      {platform === 'tiktok' && (
        <div className="space-y-2.5 text-sm">
          <Field label="Hook" value={tv.hook} />
          <Field label="Body" value={tv.body} />
          <Field label="Hashtags" value={tv.hashtags?.map((h) => `#${h}`).join(' ')} />
        </div>
      )}

      {platform === 'google' && (
        <div className="space-y-2.5 text-sm">
          <div>
            <p className="text-xs text-gray-400 mb-1">Headlines</p>
            <ol className="list-decimal list-inside space-y-0.5 text-gray-800">
              {gv.headlines?.map((h, j) => <li key={j}>{h}</li>)}
            </ol>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Descriptions</p>
            <ol className="list-decimal list-inside space-y-0.5 text-gray-800">
              {gv.descriptions?.map((d, j) => <li key={j}>{d}</li>)}
            </ol>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-gray-800">{value}</p>
    </div>
  )
}
