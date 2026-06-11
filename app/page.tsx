import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-gray-100 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">Ad</span>
            </div>
            <span className="text-lg font-semibold text-gray-900">Ad Creative AI</span>
          </div>
          <Link
            href="/login"
            className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 pt-20 pb-16">
        <div className="max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-gray-100 text-gray-500 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>
            Internal tool — personal use
          </div>
          <h1 className="text-4xl font-bold text-gray-900 leading-tight tracking-tight mb-5">
            Personal Google Ads analytics<br />
            &amp; ad copy tool
          </h1>
          <p className="text-base text-gray-500 leading-relaxed max-w-xl">
            A private internal tool for monitoring Google App Campaign performance and generating ad copy variants. Built for personal use to manage and analyze my own Google Ads accounts.
          </p>
        </div>
      </section>

      {/* Feature overview */}
      <section className="px-6 pb-16">
        <div className="max-w-2xl mx-auto grid sm:grid-cols-2 gap-4">
          <div className="border border-gray-200 rounded-2xl p-5">
            <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Campaign Dashboard</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Connects to Google Ads via API (read-only) to display spend, installs, CPI, ROAS, and CTR across all my campaigns. Includes AI-powered performance summaries and optimization notes.
            </p>
          </div>

          <div className="border border-gray-200 rounded-2xl p-5">
            <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Ad Copy Generator</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Generates platform-tuned ad copy for Google UAC, Meta, and TikTok. Input app details and get multiple variants — used for drafting creatives for my own app campaigns.
            </p>
          </div>
        </div>
      </section>

      {/* Google Ads integration detail */}
      <section className="bg-gray-50 px-6 py-16">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-base font-semibold text-gray-900 mb-6">Google Ads API usage</h2>
          <div className="space-y-4">
            {[
              {
                title: 'Read-only access',
                desc: 'The tool connects to Google Ads via OAuth 2.0 and reads campaign performance data only. No campaigns are created, modified, or deleted through this integration.',
              },
              {
                title: 'Aggregated reporting',
                desc: 'Retrieves metrics (impressions, clicks, spend, conversions) across all linked accounts and presents them in a unified dashboard view.',
              },
              {
                title: 'AI analysis',
                desc: 'Campaign data is sent to the Claude API to generate optimization recommendations — which campaigns to scale, pause, or test with new creatives.',
              },
            ].map((item) => (
              <div key={item.title} className="flex gap-3">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0 mt-2" />
                <div>
                  <p className="text-sm font-medium text-gray-800">{item.title}</p>
                  <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-100 px-6 py-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between text-xs text-gray-400">
          <span>© 2026 AR-Draw Studio</span>
          <div className="flex items-center gap-5">
            <Link href="/about" className="hover:text-gray-600 transition-colors">About</Link>
            <Link href="/privacy" className="hover:text-gray-600 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-gray-600 transition-colors">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
