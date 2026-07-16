'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'

type ConnectedGoogleAccount = {
  google_account_email: string
}

type AdAccount = {
  id: number
  google_account_email: string
  customer_id: string
  name: string | null
  currency: string | null
  timezone: string | null
  is_manager: boolean
  status: string | null
  parent_customer_id: string | null
  level: number
  tracked: boolean
  last_synced_at: string
}

function formatCustomerId(id: string) {
  return id.length === 10 ? `${id.slice(0, 3)}-${id.slice(3, 6)}-${id.slice(6)}` : id
}

export default function AccountsPage() {
  const [connections, setConnections] = useState<ConnectedGoogleAccount[]>([])
  const [accounts, setAccounts] = useState<AdAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)

  const supabase = createClient()

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const [{ data: tokens }, { data: adAccounts }] = await Promise.all([
      supabase
        .from('google_ads_tokens')
        .select('google_account_email')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('ad_accounts')
        .select('id, google_account_email, customer_id, name, currency, timezone, is_manager, status, parent_customer_id, level, tracked, last_synced_at')
        .eq('user_id', user.id)
        .order('level', { ascending: true })
        .order('name', { ascending: true }),
    ])

    setConnections(tokens ?? [])
    setAccounts((adAccounts as AdAccount[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const handleSync = async () => {
    setSyncing(true)
    setSyncError(null)
    try {
      const res = await fetch('/api/google-ads/ad-accounts', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setSyncError(data.error ?? 'Sync failed')
      } else if (data.errors?.length > 0) {
        setSyncError(`Synced with warnings: ${data.errors[0]}`)
      }
      await fetchData()
    } catch {
      setSyncError('Sync failed. Please try again.')
    }
    setSyncing(false)
  }

  // parent → children lookup for tree rendering and cascade toggling
  const childrenMap = useMemo(() => {
    const map = new Map<string, AdAccount[]>()
    for (const a of accounts) {
      if (!a.parent_customer_id) continue
      const list = map.get(a.parent_customer_id) ?? []
      list.push(a)
      map.set(a.parent_customer_id, list)
    }
    return map
  }, [accounts])

  const descendantIds = (customerId: string): string[] => {
    const out: string[] = []
    const stack = [...(childrenMap.get(customerId) ?? [])]
    while (stack.length > 0) {
      const node = stack.pop()!
      out.push(node.customer_id)
      stack.push(...(childrenMap.get(node.customer_id) ?? []))
    }
    return out
  }

  // Toggling an MCC cascades to everything under it
  const handleToggle = async (account: AdAccount) => {
    const next = !account.tracked
    const ids = [account.customer_id, ...(account.is_manager ? descendantIds(account.customer_id) : [])]

    setToggling(account.customer_id)
    setAccounts((prev) => prev.map((a) => ids.includes(a.customer_id) ? { ...a, tracked: next } : a))

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { error } = await supabase
        .from('ad_accounts')
        .update({ tracked: next })
        .eq('user_id', user.id)
        .in('customer_id', ids)
      if (error) {
        // revert optimistic update
        setAccounts((prev) => prev.map((a) => ids.includes(a.customer_id) ? { ...a, tracked: account.tracked } : a))
      }
    }
    setToggling(null)
  }

  const lastSynced = accounts.length > 0
    ? accounts.reduce((max, a) => a.last_synced_at > max ? a.last_synced_at : max, accounts[0].last_synced_at)
    : null

  const renderNode = (account: AdAccount, depth: number) => {
    const children = childrenMap.get(account.customer_id) ?? []
    return (
      <div key={account.customer_id}>
        <div
          className={`flex items-center justify-between px-4 py-2.5 border-t border-gray-100 ${account.tracked ? '' : 'opacity-50'}`}
          style={{ paddingLeft: `${16 + depth * 24}px` }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {account.is_manager ? (
              <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
              </svg>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {account.name || formatCustomerId(account.customer_id)}
                </p>
                {account.is_manager && (
                  <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">MCC</span>
                )}
                {account.status && account.status !== 'ENABLED' && (
                  <span className="text-[10px] font-semibold text-red-500 bg-red-50 border border-red-100 rounded px-1.5 py-0.5">{account.status}</span>
                )}
              </div>
              <p className="text-xs text-gray-400">
                {formatCustomerId(account.customer_id)}
                {account.currency ? ` · ${account.currency}` : ''}
                {account.timezone ? ` · ${account.timezone}` : ''}
              </p>
            </div>
          </div>

          {/* tracked toggle */}
          <button
            onClick={() => handleToggle(account)}
            disabled={toggling === account.customer_id}
            title={account.tracked ? 'Tracked — shown in dashboard & snapshots' : 'Hidden from dashboard & snapshots'}
            className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ml-3 ${
              account.tracked ? 'bg-blue-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                account.tracked ? 'translate-x-[18px]' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
        {children.map((c) => renderNode(c, depth + 1))}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400 py-10 justify-center">
        <svg className="animate-spin h-4 w-4 text-blue-500" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading...
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Ad Accounts</h1>
          <p className="text-sm text-gray-500 mt-1">
            All Google Ads accounts reachable from your connected Google logins.
            Toggle off accounts you don&apos;t want in the dashboard and daily snapshots.
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing || connections.length === 0}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex-shrink-0"
        >
          <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {syncing ? 'Syncing...' : 'Sync accounts'}
        </button>
      </div>

      {syncError && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
          {syncError}
        </div>
      )}

      {connections.length === 0 ? (
        <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 px-5 py-8 text-center space-y-3">
          <p className="text-sm text-gray-400">No Google accounts connected yet.</p>
          <Link href="/ads/connect" className="inline-block text-sm text-blue-600 hover:underline">
            Connect a Google account →
          </Link>
        </div>
      ) : accounts.length === 0 ? (
        <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 px-5 py-8 text-center space-y-3">
          <p className="text-sm text-gray-400">
            Accounts haven&apos;t been synced yet. Click <span className="font-medium">Sync accounts</span> to
            load your MCC tree from Google Ads.
          </p>
        </div>
      ) : (
        <>
          {connections.map(({ google_account_email }) => {
            const groupAccounts = accounts.filter((a) => a.google_account_email === google_account_email)
            const roots = groupAccounts.filter((a) => !a.parent_customer_id)
            const trackedCount = groupAccounts.filter((a) => a.tracked && !a.is_manager).length
            return (
              <div key={google_account_email} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 bg-green-50 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-gray-900">{google_account_email}</p>
                  </div>
                  <p className="text-xs text-gray-400">{trackedCount} tracked account{trackedCount === 1 ? '' : 's'}</p>
                </div>
                {roots.length > 0 ? (
                  roots.map((r) => renderNode(r, 0))
                ) : (
                  <p className="px-4 py-3 text-sm text-gray-400 border-t border-gray-100">
                    No accounts found for this login. Try syncing again.
                  </p>
                )}
              </div>
            )
          })}

          <div className="flex items-center justify-between text-xs text-gray-400">
            {lastSynced && <span>Last synced: {new Date(lastSynced).toLocaleString()}</span>}
            <Link href="/ads/connect" className="text-blue-600 hover:underline">
              Manage Google logins →
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
