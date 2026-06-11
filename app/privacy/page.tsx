import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy — Ad Creative AI',
  description: 'Privacy Policy for Ad Creative AI.',
}

export default function PrivacyPage() {
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
          <Link href="/generate" className="text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">
            Start for free
          </Link>
        </div>
      </nav>

      <main className="px-6 py-16">
        <div className="max-w-3xl mx-auto prose prose-gray">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
          <p className="text-gray-400 text-sm mb-12">Last updated: June 11, 2026</p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Overview</h2>
            <p className="text-gray-600 leading-relaxed">
              Ad Creative AI (&quot;we&quot;, &quot;our&quot;, &quot;the Service&quot;) is a personal internal tool operated by <strong>AR-Draw</strong>, an independent developer. This Privacy Policy explains how we collect, use, and protect your information when you use this tool at <strong>ads.ar-draw.com</strong>.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Information We Collect</h2>
            <h3 className="text-base font-semibold text-gray-800 mb-2">2.1 Account Information</h3>
            <p className="text-gray-600 leading-relaxed mb-4">
              When you sign in with Google, we receive your Google account email address and profile name. We do not receive or store your Google password.
            </p>
            <h3 className="text-base font-semibold text-gray-800 mb-2">2.2 Google Ads Data</h3>
            <p className="text-gray-600 leading-relaxed mb-4">
              If you connect a Google Ads account, we access the following data via the Google Ads API on your behalf:
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-1 mb-4">
              <li>Campaign names, status, and settings</li>
              <li>Performance metrics: impressions, clicks, CTR, conversions, and cost</li>
              <li>Ad account identifiers (Customer ID)</li>
            </ul>
            <p className="text-gray-600 leading-relaxed">
              This data is used solely to display your campaign performance dashboard within the Service. We do not sell, share, or use this data for advertising targeting purposes. We do not create, modify, or delete your Google Ads campaigns.
            </p>
            <h3 className="text-base font-semibold text-gray-800 mt-4 mb-2">2.3 User-Generated Content</h3>
            <p className="text-gray-600 leading-relaxed">
              When you use the ad copy generator, we receive the app descriptions and prompts you provide. This content is sent to the Anthropic Claude API to generate ad copy. Prompts and generated outputs may be stored to enable your generation history feature.
            </p>
            <h3 className="text-base font-semibold text-gray-800 mt-4 mb-2">2.4 Usage Data</h3>
            <p className="text-gray-600 leading-relaxed">
              We may collect standard server logs including IP addresses, browser type, pages visited, and timestamps for operational and security purposes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc list-inside text-gray-600 space-y-2 leading-relaxed">
              <li>To authenticate you and maintain your session</li>
              <li>To display your Google Ads campaign performance data in your dashboard</li>
              <li>To generate AI-powered ad copy based on your inputs</li>
              <li>To maintain your generation history</li>
              <li>To improve the reliability and performance of the Service</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Third-Party Services</h2>
            <p className="text-gray-600 leading-relaxed mb-3">We use the following third-party services:</p>
            <ul className="list-disc list-inside text-gray-600 space-y-2 leading-relaxed">
              <li><strong>Google OAuth 2.0</strong> — for authentication and Google Ads API access</li>
              <li><strong>Google Ads API</strong> — to retrieve your campaign performance data</li>
              <li><strong>Anthropic Claude API</strong> — to generate ad copy from your inputs</li>
              <li><strong>Vercel</strong> — for hosting and infrastructure</li>
            </ul>
            <p className="text-gray-600 leading-relaxed mt-3">
              Each third-party service operates under its own privacy policy. Your use of Google sign-in is subject to Google&apos;s Privacy Policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Google API Limited Use Disclosure</h2>
            <p className="text-gray-600 leading-relaxed">
              Ad Creative AI&apos;s use and transfer of information received from Google APIs adheres to the{' '}
              <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements. We only use Google Ads data to provide and improve user-facing features within the Service. We do not use this data for serving advertisements or for any purpose unrelated to the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Data Retention and Deletion</h2>
            <p className="text-gray-600 leading-relaxed">
              You may disconnect your Google Ads account at any time from the Settings page, which revokes our access to your Google Ads data. To request deletion of your account and all associated data, contact us at the email below. We will process deletion requests within 30 days.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Data Security</h2>
            <p className="text-gray-600 leading-relaxed">
              We implement industry-standard security measures including HTTPS encryption for all data in transit, and secure server-side storage for OAuth tokens. OAuth access tokens are stored server-side and never exposed to the client browser.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Children&apos;s Privacy</h2>
            <p className="text-gray-600 leading-relaxed">
              The Service is not directed at individuals under 13 years of age. We do not knowingly collect personal information from children.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Changes to This Policy</h2>
            <p className="text-gray-600 leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify users of significant changes by updating the &quot;Last updated&quot; date at the top of this page.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Contact</h2>
            <p className="text-gray-600">
              For privacy-related questions or data deletion requests, contact:<br />
              <strong>AR-Draw</strong><br />
              Email:{' '}
              <a href="mailto:contact@ar-draw.com" className="text-blue-600 hover:underline">
                contact@ar-draw.com
              </a><br />
              Address: [YOUR_ADDRESS], Vietnam
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
