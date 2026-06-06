'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function ConnectContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  return (
    <div className="max-w-lg mx-auto mt-16">
      <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
        <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </div>

        <h1 className="text-xl font-semibold text-gray-900 mb-2">
          Connect Google Ads
        </h1>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          Connect your Google account để xem tất cả MCC, campaigns và metrics của bạn trong một nơi.
          Chỉ cần đăng nhập 1 lần — app sẽ tự động truy cập tất cả accounts bạn có quyền.
        </p>

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600">
            {error === 'access_denied'
              ? 'Bạn đã từ chối quyền truy cập. Vui lòng thử lại.'
              : 'Có lỗi xảy ra. Vui lòng thử lại.'}
          </div>
        )}

        <a
          href="/api/google-ads/auth"
          className="inline-flex items-center justify-center gap-2.5 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-xl transition-colors text-sm"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Connect với Google Ads
        </a>

        <p className="mt-4 text-xs text-gray-400">
          App chỉ đọc dữ liệu. Không có quyền chỉnh sửa campaigns.
        </p>
      </div>
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
