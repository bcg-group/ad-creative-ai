'use client'

import { useEffect, useState } from 'react'
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

// Maps Google Ads status enum → display label + badge colors
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
        .order('is_manager', { ascending: false })
        .order('name', { ascending: true }),
    ])

    setConnections(tokens ?? [])
    setAccounts((adAccounts as AdAccount[]) ?? [])
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

  const handleToggle = async (account: AdAccount) => {
    const next = !account.tracked
    setToggling(account.customer_id)
    setAccounts((prev) => prev.map((a) => a.customer_id === account.customer_id ? { ...a, tracked: next } : a))

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { error } = await supabase
        .from('ad_accounts')
        .update({ tracked: next })
        .eq('user_id', user.id)
        .eq('customer_id', account.customer_id)
      if (error) {
        setAccounts((prev) => prev.map((a) => a.customer_id === account.customer_id ? { ...a, tracked: account.tracked } : a))
      }
    }
    setToggling(null)
  }

  const lastSynced = accounts.length > 0
    ? accounts.reduce((max, a) => a.last_synced_at > max ? a.last_synced_at : max, accounts[0].last_synced_at)
    : null

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
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Ad Accounts</h1>
          <p className="text-sm text-gray-500 mt-1">
            Danh sách tài khoản Google Ads truy cập được từ các Google login đã kết nối.
            Tắt công tắc để loại account khỏi dashboard và snapshot hằng ngày.
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
          {syncing ? 'Đang đồng bộ...' : 'Sync accounts'}
        </button>
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
            Nếu bấm Sync vẫn báo lỗi: đảm bảo đã chạy migration <code className="bg-gray-100 px-1 rounded">003_ad_accounts.sql</code> trong Supabase.
          </p>
        </div>
      ) : (
        <>
          {connections.map(({ google_account_email }) => {
            const groupAccounts = accounts.filter((a) => a.google_account_email === google_account_email)
            const trackedCount = groupAccounts.filter((a) => a.tracked && !a.is_manager).length
            return (
              <div key={google_account_email} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 flex items-center justify-between border-b border-gray-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 bg-green-50 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-gray-900">{google_account_email}</p>
                  </div>
                  <p className="text-xs text-gray-400">
                    {groupAccounts.length} tài khoản · {trackedCount} đang theo dõi
                  </p>
                </div>

                {groupAccounts.length === 0 ? (
                  <p className="px-4 py-4 text-sm text-gray-400">Không tìm thấy tài khoản cho login này.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs font-semibold text-gray-500 border-b border-gray-100">
                          <th className="px-4 py-2.5 w-12">Stt</th>
                          <th className="px-4 py-2.5">Type</th>
                          <th className="px-4 py-2.5">Id</th>
                          <th className="px-4 py-2.5">Status</th>
                          <th className="px-4 py-2.5">Currency</th>
                          <th className="px-4 py-2.5">Timezone</th>
                          <th className="px-4 py-2.5 text-right">Theo dõi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupAccounts.map((account, idx) => {
                          const st = statusDisplay(account.status)
                          return (
                            <tr
                              key={account.customer_id}
                              className={`border-b border-gray-50 hover:bg-gray-50/60 ${account.tracked ? '' : 'opacity-50'}`}
                            >
                              <td className="px-4 py-2.5 text-gray-400">{idx + 1}</td>
                              <td className="px-4 py-2.5">
                                <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                                  account.is_manager ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {account.is_manager ? 'MCC' : 'Cá nhân'}
                                </span>
                              </td>
                              <td className="px-4 py-2.5">
                                <div className="font-medium text-blue-600">{formatCustomerId(account.customer_id)}</div>
                                {account.name && <div className="text-xs text-gray-400 mt-0.5 truncate max-w-[220px]">{account.name}</div>}
                              </td>
                              <td className="px-4 py-2.5">
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded ${st.className}`}>
                                  {st.label}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-gray-700">{account.currency ?? '—'}</td>
                              <td className="px-4 py-2.5 text-gray-700">{account.timezone ?? '—'}</td>
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
