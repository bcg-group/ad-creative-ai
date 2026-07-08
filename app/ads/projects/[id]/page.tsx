'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

type Project = {
  id: string
  name: string
  category: string | null
  app_url: string | null
}

type Generation = {
  id: string
  platform: string
  tone: string
  app_name: string
  result: any
  created_at: string
}

type CampaignLink = {
  id: string
  generation_id: string
  campaign_id: string
  campaign_name: string | null
  customer_id: string
  google_account_email: string | null
}

const PLATFORM_LABEL: Record<string, string> = {
  google: 'Google UAC',
  meta: 'Meta',
  tiktok: 'TikTok',
}

const PLATFORM_COLOR: Record<string, string> = {
  google: 'bg-blue-50 text-blue-700',
  meta: 'bg-indigo-50 text-indigo-700',
  tiktok: 'bg-pink-50 text-pink-700',
}

function GenerationPreview({ gen }: { gen: Generation }) {
  const { platform, result } = gen
  if (platform === 'google' && result?.variants?.[0]) {
    const v = result.variants[0]
    return (
      <div className="text-sm text-gray-600 space-y-1">
        <p className="font-medium text-gray-800 truncate">{v.headlines?.[0]}</p>
        <p className="text-gray-500 truncate">{v.descriptions?.[0]}</p>
      </div>
    )
  }
  if (platform === 'meta' && result?.variants?.[0]) {
    const v = result.variants[0]
    return (
      <div className="text-sm text-gray-600 space-y-1">
        <p className="font-medium text-gray-800 truncate">{v.headline}</p>
        <p className="text-gray-500 truncate">{v.primaryText}</p>
      </div>
    )
  }
  if (platform === 'tiktok' && result?.variants?.[0]) {
    const v = result.variants[0]
    return (
      <div className="text-sm text-gray-600 space-y-1">
        <p className="font-medium text-gray-800 truncate">{v.hook}</p>
        <p className="text-gray-500 truncate">{v.body}</p>
      </div>
    )
  }
  return null
}

function LinkCampaignModal({
  generationId,
  onClose,
  onLinked,
}: {
  generationId: string
  onClose: () => void
  onLinked: (link: CampaignLink) => void
}) {
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCampaign, setSelectedCampaign] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  useEffect(() => {
    fetch('/api/google-ads/campaigns')
      .then((r) => r.json())
      .then((d) => { setCampaigns(d.campaigns ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const handleLink = async () => {
    if (!selectedCampaign) return
    setSaving(true)
    setError('')
    const campaign = campaigns.find((c) => c.campaignId === selectedCampaign)
    if (!campaign) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error: err } = await supabase.from('campaign_links').insert({
      user_id: user.id,
      generation_id: generationId,
      campaign_id: campaign.campaignId,
      campaign_name: campaign.campaignName,
      customer_id: campaign.customerId,
      google_account_email: campaign.googleAccountEmail,
    }).select().single()

    if (err) {
      setError(err.code === '23505' ? 'Campaign already linked.' : err.message)
    } else if (data) {
      onLinked(data as CampaignLink)
      onClose()
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Link Campaign</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400 py-4 text-center">Loading campaigns...</p>
        ) : campaigns.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">
            No campaigns found.{' '}
            <a href="/ads/connect" className="text-blue-600 hover:underline">Connect Google Ads →</a>
          </p>
        ) : (
          <select
            value={selectedCampaign}
            onChange={(e) => setSelectedCampaign(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">— Select campaign —</option>
            {campaigns.map((c) => (
              <option key={c.campaignId} value={c.campaignId}>
                {c.campaignName} ({c.accountName})
              </option>
            ))}
          </select>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
            Cancel
          </button>
          <button
            onClick={handleLink}
            disabled={!selectedCampaign || saving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {saving ? 'Linking...' : 'Link Campaign'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ProjectDetailPage() {
  const params = useParams()
  const projectId = params.id as string
  const supabase = createClient()

  const [project, setProject] = useState<Project | null>(null)
  const [generations, setGenerations] = useState<Generation[]>([])
  const [links, setLinks] = useState<CampaignLink[]>([])
  const [loading, setLoading] = useState(true)
  const [linkingGenId, setLinkingGenId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const [{ data: proj }, { data: gens }, { data: lnks }] = await Promise.all([
        supabase.from('projects').select('id, name, category, app_url').eq('id', projectId).single(),
        supabase.from('generations').select('id, platform, tone, app_name, result, created_at')
          .eq('project_id', projectId).order('created_at', { ascending: false }),
        supabase.from('campaign_links').select('*').in(
          'generation_id',
          // placeholder — will be replaced after generations load
          ['00000000-0000-0000-0000-000000000000']
        ),
      ])
      setProject(proj)
      setGenerations(gens ?? [])
      setLoading(false)

      // Load campaign links for these generations
      if (gens && gens.length > 0) {
        const { data: realLinks } = await supabase
          .from('campaign_links')
          .select('*')
          .in('generation_id', gens.map((g) => g.id))
        setLinks(realLinks ?? [])
      }
    }
    load()
  }, [projectId])

  const linksForGen = (genId: string) => links.filter((l) => l.generation_id === genId)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-gray-400 gap-2">
        <svg className="animate-spin h-4 w-4 text-blue-500" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading...
      </div>
    )
  }

  if (!project) {
    return (
      <div className="text-center py-20 text-sm text-gray-400">
        Project not found. <a href="/ads/projects" className="text-blue-600 hover:underline">Back to Projects →</a>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <a href="/ads/projects" className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </a>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{project.name}</h1>
          <div className="flex items-center gap-3 mt-0.5">
            {project.category && <span className="text-xs text-gray-400">{project.category}</span>}
            {project.app_url && (
              <a href={project.app_url} target="_blank" rel="noopener noreferrer"
                className="text-xs text-blue-500 hover:underline">Store →</a>
            )}
          </div>
        </div>
        <a
          href={`/generate`}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Creative
        </a>
      </div>

      {/* Generations list */}
      {generations.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center space-y-2">
          <p className="text-sm text-gray-400">No creatives yet for this project.</p>
          <a href="/generate" className="text-sm text-blue-600 hover:underline">
            Go to Generate →
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          {generations.map((gen) => {
            const genLinks = linksForGen(gen.id)
            return (
              <div key={gen.id} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
                {/* Creative header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PLATFORM_COLOR[gen.platform] ?? 'bg-gray-100 text-gray-600'}`}>
                      {PLATFORM_LABEL[gen.platform] ?? gen.platform}
                    </span>
                    <span className="text-xs text-gray-400 capitalize">{gen.tone}</span>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {new Date(gen.created_at).toLocaleDateString()}
                  </span>
                </div>

                {/* Preview */}
                <GenerationPreview gen={gen} />

                {/* Linked campaigns */}
                {genLinks.length > 0 && (
                  <div className="space-y-1.5 pt-1 border-t border-gray-100">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Linked Campaigns</p>
                    {genLinks.map((lnk) => (
                      <div key={lnk.id} className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                        <svg className="w-3.5 h-3.5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.172 13.828a4 4 0 015.656 0l4-4a4 4 0 01-5.656-5.656l-1.101 1.102" />
                        </svg>
                        <span className="font-medium truncate">{lnk.campaign_name ?? lnk.campaign_id}</span>
                        {lnk.google_account_email && (
                          <span className="text-gray-400 ml-auto flex-shrink-0">{lnk.google_account_email}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Link campaign button */}
                <button
                  onClick={() => setLinkingGenId(gen.id)}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Link Campaign
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Link campaign modal */}
      {linkingGenId && (
        <LinkCampaignModal
          generationId={linkingGenId}
          onClose={() => setLinkingGenId(null)}
          onLinked={(link) => setLinks((prev) => [...prev, link])}
        />
      )}
    </div>
  )
}
