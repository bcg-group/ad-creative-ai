'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/utils/supabase/client'

type ConnectedAccount = {
  id: string
  google_account_email: string
  google_account_id: string
  created_at: string
}

function ConnectContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const justConnected = searchParams.get('connected') === 'true'

  const [accounts, setAccounts] = useState<ConnectedAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [removing, setRemoving] = useState<string | null>(null)

  const supabase = createClient()

  const fetchAccounts = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data } = await supabase
      .from('google_ads_tokens')
      .select('id, google_account_email, google_account_id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    setAccounts(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchAccounts() }, [])

  const handleRemove = async (id: string) => {
    setRemoving(id)
    await supabase.from('google_ads_tokens').delete().eq('id', id)
    setAccounts((prev) => prev.filter((a) => a.id !== id))
    setRemoving(null)
  }

  return (
    <div className="max-w-lg mx-auto mt-10 space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Google Ads Accounts</h1>
        <p className="text-sm text-gray-500 mt-1">
          Connect multiple Google accounts to manage all MCCs in one dashboard.
        </p>
      </div>

      {justConnected && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700">
          Account connected successfully!
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">
          {error === 'access_denied' && 'You denied access.'}
          {error === 'token_exchange_failed' && 'Could not retrieve token. Please try again.'}
          {error === 'userinfo_failed' && 'Could not retrieve account info. Please try again.'}
          {!['access_denied', 'token_exchange_failed', 'userinfo_failed'].includes(error) && 'An error occurred.'}
        </div>
      )}

      {/* Connected accounts list */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
          <svg className="animate-spin h-4 w-4 text-blue-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading...
        </div>
      ) : accounts.length > 0 ? (
        <div className="space-y-2">
          {accounts.map((account) => (
            <div key={account.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-50 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{account.google_account_email}</p>
                  <p className="text-xs text-gray-400">Connected</p>
                </div>
              </div>
              <button
                onClick={() => handleRemove(account.id)}
                disabled={removing === account.id}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors px-2 py-1 rounded"
              >
                {removing === account.id ? '...' : 'Remove'}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 px-5 py-6 text-center">
          <p className="text-sm text-gray-400">No Google accounts connected yet.</p>
        </div>
      )}

      {/* Connect button */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <p className="text-sm font-medium text-gray-700 mb-1">
          {accounts.length > 0 ? 'Add another Google account' : 'Connect Google account'}
        </p>
        <p className="text-xs text-gray-400 mb-4">
          Each connection adds one Google account with all its MCCs and sub-accounts.
        </p>
        <a
          href="/api/google-ads/auth"
          className="inline-flex items-center justify-center gap-2.5 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors text-sm"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          {accounts.length > 0 ? 'Connect another account' : 'Connect with Google Ads'}
        </a>
        <p className="mt-3 text-xs text-gray-400 text-center">
          Read-only access. No permission to edit campaigns.
        </p>
      </div>

      {accounts.length > 0 && (
        <div className="text-center">
          <a href="/ads/dashboard" className="text-sm text-blue-600 hover:underline">
            Xem Campaign Dashboard →
          </a>
        </div>
      )}
    </div>
  )
}

export default function ConnectPage() {
  return (
    <Suspense>
      <ConnectContent />
    </Suspense>
  )
}
