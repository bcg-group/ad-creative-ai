import Link from 'next/link'

export const metadata = {
  title: 'About — Ad Creative AI',
  description: 'Ad Creative AI is a personal internal tool for monitoring Google Ads campaigns and generating ad copy.',
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-gray-100 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">Ad</span>
            </div>
            <span className="text-lg font-semibold text-gray-900">Ad Creative AI</span>
          </Link>
          <Link href="/login" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
            Sign in
          </Link>
        </div>
      </nav>

      <main className="px-6 py-16">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">About</h1>
          <p className="text-gray-500 text-lg mb-12">What this tool is and why it was built.</p>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">What This Is</h2>
            <p className="text-gray-600 leading-relaxed">
              Ad Creative AI is a personal internal tool built to manage and analyze Google App Campaigns for my own mobile apps. It is not a commercial product — it was developed by an individual developer for personal campaign management use, with no public user base or subscription model.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">What It Does</h2>
            <ul className="list-disc list-inside text-gray-600 space-y-2 leading-relaxed">
              <li>Connects to Google Ads accounts via OAuth 2.0 to retrieve campaign performance data (read-only)</li>
              <li>Displays a unified campaign dashboard with metrics: impressions, clicks, spend, CPI, ROAS, CTR</li>
              <li>Aggregates data across multiple linked Google Ads accounts in one view</li>
              <li>Uses the Claude AI API to generate optimization recommendations based on campaign data</li>
              <li>Generates ad copy variants (headlines, descriptions) for Google UAC, Meta, and TikTok campaigns</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Google Ads API Usage</h2>
            <p className="text-gray-600 leading-relaxed">
              This tool integrates with the Google Ads API exclusively for read-only campaign reporting. The API is used to retrieve campaign names, status, and performance metrics (impressions, clicks, cost, conversions) for accounts I own and manage. No campaigns are created, modified, paused, or deleted through this integration. Users authenticate via Google OAuth 2.0 and access is limited to accounts they explicitly authorize.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">The Developer</h2>
            <p className="text-gray-600 leading-relaxed">
              Ad Creative AI is developed and maintained by <strong>AR-Draw</strong>, an independent software developer based in Vietnam. The developer runs mobile app advertising campaigns on Google, Meta, and TikTok, and built this tool to solve the practical problem of monitoring multiple campaign accounts in one place and generating ad creatives efficiently.
            </p>
            <p className="text-gray-600 leading-relaxed mt-3">
              This is a solo-developer, personal-use project. It is not affiliated with any agency or advertising platform.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Contact</h2>
            <p className="text-gray-600">
              For questions or data requests, contact:{' '}
              <a href="mailto:contact@ar-draw.com" className="text-blue-600 hover:underline">
                contact@ar-draw.com
              </a>
            </p>
            <p className="text-gray-600 mt-2">
              Business address: [YOUR_ADDRESS], Vietnam
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-gray-100 px-6 py-6">
        <div className="max-w-3xl mx-auto flex items-center gap-6 text-xs text-gray-400">
          <span>© 2026 AR-Draw</span>
          <Link href="/about" className="hover:text-gray-600 transition-colors">About</Link>
          <Link href="/privacy" className="hover:text-gray-600 transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-gray-600 transition-colors">Terms of Service</Link>
        </div>
      </footer>
    </div>
  )
}
