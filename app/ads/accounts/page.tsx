'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
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
  billing_status: string | null
  payments_account_id: string | null
  payments_account_name: string | null
  last_synced_at: string
}

function formatCustomerId(id: string) {
  return id.length === 10 ? `${id.slice(0, 3)}-${id.slice(3, 6)}-${id.slice(6)}` : id
}

function statusDisplay(status: string | null): { label: string; className: string } {
  switch ((status ?? '').toUpperCase()) {
    case 'ENABLED':
      return { label: 'Active', className: 'bg-green-100 text-green-700' }
    case 'SUSPENDED':
      return { label: 'account_suspended', className: 'bg-red-100 text-red-700' }
    case 'CANCELED':
    case 'CANCELLED':
      return { label: 'Deactive', className: 'bg-gray-200 text-gray-600' }
    case 'CLOSED':
      return { label: 'Closed', className: 'bg-gray-200 text-gray-600' }
    default:
      return { label: status || 'Unknown', className: 'bg-gray-100 text-gray-500' }
  }
}

type Campaign = {
  campaignId: string
  campaignName: string
  status: string
}

// 'loading' | 'error' | Campaign[] once loaded
type CampaignState = 'loading' | 'error' | Campaign[]

function campaignStatusDisplay(status: string): { label: string; className: string } {
  switch ((status ?? '').toUpperCase()) {
    case 'ENABLED':
      return { label: 'Enabled', className: 'bg-green-100 text-green-700' }
    case 'PAUSED':
      return { label: 'Paused', className: 'bg-amber-100 text-amber-700' }
    default:
      return { label: status || '—', className: 'bg-gray-100 text-gray-500' }
  }
}

function billingDisplay(status: string | null): { label: string; className: string } {
  switch ((status ?? '').toUpperCase()) {
    case 'APPROVED':
      return { label: 'Approved', className: 'bg-green-100 text-green-700' }
    case 'PENDING':
      return { label: 'Pending', className: 'bg-amber-100 text-amber-700' }
    case 'APPROVED_HELD':
      return { label: 'Held', className: 'bg-amber-100 text-amber-700' }
    case 'CANCELLED':
    case 'CANCELED':
      return { label: 'Cancelled', className: 'bg-gray-200 text-gray-600' }
    default:
      return { label: '—', className: 'text-gray-400' }
  }
}

export default function AccountsPage() {
  const [connections, setConnections] = useState<ConnectedGoogleAccount[]>([])
  const [accounts, setAccounts] = useState<AdAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)
  // Which Google-login sections are expanded, and which MCC subtrees are collapsed
  const [openLogins, setOpenLogins] = useState<Set<string>>(new Set())
  const [collapsedManagers, setCollapsedManagers] = useState<Set<string>>(new Set())
  // Inline campaign panels: which account rows are expanded + their loaded campaigns
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set())
  const [campaignsByAccount, setCampaignsByAccount] = useState<Map<string, CampaignState>>(new Map())
  const [expandingAll, setExpandingAll] = useState(false)
  const [mutatingCampaigns, setMutatingCampaigns] = useState<Set<string>>(new Set())

  const supabase = createClient()

  const setCampaignStatus = (customerId: string, campaignId: string, status: string) => {
    setCampaignsByAccount((prev) => {
      const cur = prev.get(customerId)
      if (!Array.isArray(cur)) return prev
      return new Map(prev).set(customerId, cur.map((c) => c.campaignId === campaignId ? { ...c, status } : c))
    })
  }

  // Enable ↔ pause a campaign via the API, optimistic with revert on failure.
  const toggleCampaignStatus = async (customerId: string, campaign: Campaign) => {
    const next = campaign.status === 'ENABLED' ? 'PAUSED' : 'ENABLED'
    setMutatingCampaigns((prev) => new Set(prev).add(campaign.campaignId))
    setCampaignStatus(customerId, campaign.campaignId, next)
    try {
      const res = await fetch('/api/google-ads/account-campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: customerId, campaign_id: campaign.campaignId, status: next }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setCampaignStatus(customerId, campaign.campaignId, campaign.status)
    }
    setMutatingCampaigns((prev) => {
      const n = new Set(prev)
      n.delete(campaign.campaignId)
      return n
    })
  }

  const loadCampaigns = async (customerId: string) => {
    setCampaignsByAccount((prev) => new Map(prev).set(customerId, 'loading'))
    try {
      const res = await fetch(`/api/google-ads/account-campaigns?customer_id=${customerId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'load failed')
      setCampaignsByAccount((prev) => new Map(prev).set(customerId, data.campaigns as Campaign[]))
    } catch {
      setCampaignsByAccount((prev) => new Map(prev).set(customerId, 'error'))
    }
  }

  const toggleCampaigns = (customerId: string) => {
    const willOpen = !expandedAccounts.has(customerId)
    setExpandedAccounts((prev) => {
      const next = new Set(prev)
      willOpen ? next.add(customerId) : next.delete(customerId)
      return next
    })
    if (willOpen && !campaignsByAccount.has(customerId)) loadCampaigns(customerId)
  }

  // Open every login + MCC, then lazy-load campaigns for all leaf accounts in
  // batches of 5 so we don't fire dozens of API calls at once.
  const expandAll = async () => {
    setExpandingAll(true)
    setOpenLogins(new Set(connections.map((c) => c.google_account_email)))
    setCollapsedManagers(new Set())
    const leaves = accounts.filter((a) => !a.is_manager)
    setExpandedAccounts(new Set(leaves.map((a) => a.customer_id)))
    const toLoad = leaves.filter((a) => !campaignsByAccount.has(a.customer_id))
    for (let i = 0; i < toLoad.length; i += 5) {
      await Promise.all(toLoad.slice(i, i + 5).map((a) => loadCampaigns(a.customer_id)))
    }
    setExpandingAll(false)
  }

  const collapseAll = () => setExpandedAccounts(new Set())

  const toggleLogin = (email: string) => setOpenLogins((prev) => {
    const next = new Set(prev)
    next.has(email) ? next.delete(email) : next.add(email)
    return next
  })

  const toggleManager = (customerId: string) => setCollapsedManagers((prev) => {
    const next = new Set(prev)
    next.has(customerId) ? next.delete(customerId) : next.add(customerId)
    return next
  })

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
        .select('id, google_account_email, customer_id, name, currency, timezone, is_manager, status, parent_customer_id, level, tracked, billing_status, payments_account_id, payments_account_name, last_synced_at')
        .eq('user_id', user.id)
        .order('name', { ascending: true }),
    ])

    setConnections(tokens ?? [])
    setAccounts((adAccounts as AdAccount[]) ?? [])
    // Open the first login by default; keep the rest collapsed for a compact view
    setOpenLogins((prev) => prev.size > 0 ? prev : new Set(tokens?.[0] ? [tokens[0].google_account_email] : []))
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSync = async () => {
    setSyncing(true)
    setSyncError(null)
    try {
      const res = await fetch('/api/google-ads/ad-accounts', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setSyncError(data.error ?? 'Sync failed')
      } else if (data.errors?.length > 0) {
        setSyncError(`Đồng bộ xong nhưng có cảnh báo: ${data.errors[0]}`)
      }
      await fetchData()
    } catch {
      setSyncError('Sync failed. Please try again.')
    }
    setSyncing(false)
  }

  // parent → children lookup for tree flattening and cascade toggling
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
        setAccounts((prev) => prev.map((a) => ids.includes(a.customer_id) ? { ...a, tracked: account.tracked } : a))
      }
    }
    setToggling(null)
  }

  const lastSynced = accounts.length > 0
    ? accounts.reduce((max, a) => a.last_synced_at > max ? a.last_synced_at : max, accounts[0].last_synced_at)
    : null

  // DFS a login group into an ordered list so managers sit above their indented
  // children. hasChildren drives the collapse chevron; collapsed MCCs hide their
  // subtree. Accounts whose parent isn't in the group are treated as roots.
  const flattenTree = (groupAccounts: AdAccount[]): { account: AdAccount; depth: number; hasChildren: boolean }[] => {
    const out: { account: AdAccount; depth: number; hasChildren: boolean }[] = []
    const inGroup = new Set(groupAccounts.map((a) => a.customer_id))
    const roots = groupAccounts.filter((a) => !a.parent_customer_id || !inGroup.has(a.parent_customer_id))
    const walk = (node: AdAccount, depth: number) => {
      const kids = (childrenMap.get(node.customer_id) ?? [])
        .filter((k) => k.google_account_email === node.google_account_email)
      out.push({ account: node, depth, hasChildren: kids.length > 0 })
      if (collapsedManagers.has(node.customer_id)) return
      for (const k of kids) walk(k, depth + 1)
    }
    for (const r of roots) walk(r, 0)
    return out
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
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Ad Accounts</h1>
          <p className="text-sm text-gray-500 mt-1">
            Cây tài khoản Google Ads (MCC → tài khoản con) kèm trạng thái và billing.
            Tắt công tắc để loại account khỏi dashboard và snapshot hằng ngày.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {accounts.length > 0 && (
            expandedAccounts.size > 0 ? (
              <button
                onClick={collapseAll}
                disabled={expandingAll}
                className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                Đóng tất cả campaign
              </button>
            ) : (
              <button
                onClick={expandAll}
                disabled={expandingAll}
                className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-60 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                <svg className={`w-4 h-4 ${expandingAll ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {expandingAll
                    ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />}
                </svg>
                {expandingAll ? 'Đang mở...' : 'Mở tất cả campaign'}
              </button>
            )
          )}
          <button
            onClick={handleSync}
            disabled={syncing || connections.length === 0}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {syncing ? 'Đang đồng bộ...' : 'Sync accounts'}
          </button>
        </div>
      </div>

      {syncError && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
          {syncError}
        </div>
      )}

      {connections.length === 0 ? (
        <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 px-5 py-8 text-center space-y-3">
          <p className="text-sm text-gray-400">Chưa kết nối Google account nào.</p>
          <Link href="/ads/connect" className="inline-block text-sm text-blue-600 hover:underline">
            Kết nối Google account →
          </Link>
        </div>
      ) : accounts.length === 0 ? (
        <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 px-5 py-8 text-center space-y-3">
          <p className="text-sm text-gray-400">
            Chưa có dữ liệu. Bấm <span className="font-medium">Sync accounts</span> để nạp danh sách
            tài khoản từ Google Ads.
          </p>
          <p className="text-xs text-gray-400">
            Nếu bấm Sync vẫn báo lỗi: đảm bảo đã chạy migration <code className="bg-gray-100 px-1 rounded">003</code> và <code className="bg-gray-100 px-1 rounded">004</code> trong Supabase.
          </p>
        </div>
      ) : (
        <>
          {connections.map(({ google_account_email }) => {
            const groupAccounts = accounts.filter((a) => a.google_account_email === google_account_email)
            const trackedCount = groupAccounts.filter((a) => a.tracked && !a.is_manager).length
            const activeCount = groupAccounts.filter((a) => (a.status ?? '').toUpperCase() === 'ENABLED' && !a.is_manager).length
            const isOpen = openLogins.has(google_account_email)
            const flat = isOpen ? flattenTree(groupAccounts) : []
            return (
              <div key={google_account_email} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <button
                  onClick={() => toggleLogin(google_account_email)}
                  className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between border-b border-gray-100 text-left transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <div className="w-7 h-7 bg-green-50 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-gray-900">{google_account_email}</p>
                  </div>
                  <p className="text-xs text-gray-400">
                    {groupAccounts.length} tài khoản · {activeCount} active · {trackedCount} đang theo dõi
                  </p>
                </button>

                {!isOpen ? null : flat.length === 0 ? (
                  <p className="px-4 py-4 text-sm text-gray-400">Không tìm thấy tài khoản cho login này.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm whitespace-nowrap">
                      <thead>
                        <tr className="text-left text-xs font-semibold text-gray-500 border-b border-gray-100">
                          <th className="px-4 py-2.5">Account</th>
                          <th className="px-4 py-2.5">Type</th>
                          <th className="px-4 py-2.5">Status</th>
                          <th className="px-4 py-2.5">Currency</th>
                          <th className="px-4 py-2.5">Timezone</th>
                          <th className="px-4 py-2.5">Billing</th>
                          <th className="px-4 py-2.5">Payments account</th>
                          <th className="px-4 py-2.5 text-right">Theo dõi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {flat.map(({ account, depth, hasChildren }) => {
                          const st = statusDisplay(account.status)
                          const bl = billingDisplay(account.billing_status)
                          const collapsed = collapsedManagers.has(account.customer_id)
                          const campaignExpanded = !account.is_manager && expandedAccounts.has(account.customer_id)
                          const campaignState = campaignsByAccount.get(account.customer_id)
                          return (
                            <Fragment key={account.customer_id}>
                            <tr
                              className={`border-b border-gray-50 hover:bg-gray-50/60 ${account.tracked ? '' : 'opacity-50'}`}
                            >
                              <td className="px-4 py-2.5" style={{ paddingLeft: `${16 + depth * 22}px` }}>
                                <div className="flex items-center gap-2">
                                  {hasChildren ? (
                                    <button
                                      onClick={() => toggleManager(account.customer_id)}
                                      title={collapsed ? 'Mở rộng' : 'Thu gọn'}
                                      className="p-0.5 -ml-1 rounded hover:bg-gray-200 flex-shrink-0"
                                    >
                                      <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${collapsed ? '' : 'rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                      </svg>
                                    </button>
                                  ) : !account.is_manager ? (
                                    <button
                                      onClick={() => toggleCampaigns(account.customer_id)}
                                      title={campaignExpanded ? 'Ẩn campaign' : 'Xem campaign'}
                                      className="p-0.5 -ml-1 rounded hover:bg-gray-200 flex-shrink-0"
                                    >
                                      <svg className={`w-3.5 h-3.5 text-blue-400 transition-transform ${campaignExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                      </svg>
                                    </button>
                                  ) : (
                                    <span className="w-3.5 flex-shrink-0" />
                                  )}
                                  {account.is_manager ? (
                                    <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                    </svg>
                                  ) : (
                                    <svg className="w-4 h-4 text-blue-300 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                      <circle cx="10" cy="10" r="4" />
                                    </svg>
                                  )}
                                  <div>
                                    <div className="font-medium text-blue-600">
                                      {formatCustomerId(account.customer_id)}
                                      {hasChildren && collapsed && (
                                        <span className="ml-1.5 text-xs font-normal text-gray-400">
                                          ({(childrenMap.get(account.customer_id) ?? []).length})
                                        </span>
                                      )}
                                    </div>
                                    {account.name && <div className="text-xs text-gray-400 mt-0.5 truncate max-w-[220px]">{account.name}</div>}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-2.5">
                                <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                                  account.is_manager ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {account.is_manager ? 'MCC' : 'Cá nhân'}
                                </span>
                              </td>
                              <td className="px-4 py-2.5">
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded ${st.className}`}>{st.label}</span>
                              </td>
                              <td className="px-4 py-2.5 text-gray-700">{account.currency ?? '—'}</td>
                              <td className="px-4 py-2.5 text-gray-700">{account.timezone ?? '—'}</td>
                              <td className="px-4 py-2.5">
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded ${bl.className}`}>{bl.label}</span>
                              </td>
                              <td className="px-4 py-2.5 text-gray-600">
                                {account.payments_account_name || account.payments_account_id || (account.is_manager ? '—' : '(chưa có)')}
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <button
                                  onClick={() => handleToggle(account)}
                                  disabled={toggling === account.customer_id}
                                  title={account.tracked ? 'Đang theo dõi' : 'Đã ẩn khỏi dashboard & snapshot'}
                                  className={`relative inline-block w-9 h-5 rounded-full transition-colors align-middle ${
                                    account.tracked ? 'bg-blue-600' : 'bg-gray-300'
                                  }`}
                                >
                                  <span
                                    className={`absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                                      account.tracked ? 'translate-x-4' : 'translate-x-0'
                                    }`}
                                  />
                                </button>
                              </td>
                            </tr>

                            {campaignExpanded && (
                              <tr className="bg-blue-50/30">
                                <td colSpan={8} className="p-0">
                                  <div className="py-3 pr-4" style={{ paddingLeft: `${16 + (depth + 1) * 22}px` }}>
                                    {campaignState === 'loading' || campaignState === undefined ? (
                                      <div className="flex items-center gap-2 text-xs text-gray-400">
                                        <svg className="animate-spin h-3.5 w-3.5 text-blue-500" viewBox="0 0 24 24" fill="none">
                                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        Đang tải campaign...
                                      </div>
                                    ) : campaignState === 'error' ? (
                                      <p className="text-xs text-red-500">
                                        Không tải được campaign.
                                        <button onClick={() => loadCampaigns(account.customer_id)} className="ml-2 underline">Thử lại</button>
                                      </p>
                                    ) : campaignState.length === 0 ? (
                                      <p className="text-xs text-gray-400">Không có campaign nào trong 30 ngày.</p>
                                    ) : (
                                      <table className="w-full text-xs bg-white rounded-lg border border-gray-100 overflow-hidden">
                                        <thead>
                                          <tr className="text-left text-[11px] font-semibold text-gray-400 border-b border-gray-100">
                                            <th className="px-3 py-2">Campaign</th>
                                            <th className="px-3 py-2">Status</th>
                                            <th className="px-3 py-2 text-right">Bật / Tắt</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {campaignState.map((c) => {
                                            const cs = campaignStatusDisplay(c.status)
                                            const enabled = c.status === 'ENABLED'
                                            const busy = mutatingCampaigns.has(c.campaignId)
                                            return (
                                              <tr key={c.campaignId} className="border-b border-gray-50 last:border-0">
                                                <td className="px-3 py-2 text-gray-800 max-w-[380px] truncate">{c.campaignName}</td>
                                                <td className="px-3 py-2">
                                                  <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${cs.className}`}>{cs.label}</span>
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                  <button
                                                    onClick={() => toggleCampaignStatus(account.customer_id, c)}
                                                    disabled={busy}
                                                    title={enabled ? 'Đang bật — bấm để tạm dừng' : 'Đang tạm dừng — bấm để bật'}
                                                    className={`relative inline-block w-9 h-5 rounded-full transition-colors align-middle disabled:opacity-50 ${
                                                      enabled ? 'bg-green-500' : 'bg-gray-300'
                                                    }`}
                                                  >
                                                    <span
                                                      className={`absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                                                        enabled ? 'translate-x-4' : 'translate-x-0'
                                                      }`}
                                                    />
                                                  </button>
                                                </td>
                                              </tr>
                                            )
                                          })}
                                        </tbody>
                                      </table>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                            </Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}

          <div className="flex items-center justify-between text-xs text-gray-400">
            {lastSynced && <span>Đồng bộ lần cuối: {new Date(lastSynced).toLocaleString()}</span>}
            <Link href="/ads/connect" className="text-blue-600 hover:underline">
              Quản lý Google login →
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
