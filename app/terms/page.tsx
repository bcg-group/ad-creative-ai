import Link from 'next/link'

export const metadata = {
  title: 'Terms of Service — Ad Creative AI',
  description: 'Terms of Service for Ad Creative AI.',
}

export default function TermsPage() {
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
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Terms of Service</h1>
          <p className="text-gray-400 text-sm mb-12">Last updated: June 11, 2026</p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Acceptance of Terms</h2>
            <p className="text-gray-600 leading-relaxed">
              By accessing or using Ad Creative AI (&quot;the Service&quot;) at <strong>ads.ar-draw.com</strong>, you agree to be bound by these Terms of Service. If you do not agree, please do not use the Service. The Service is operated by <strong>AR-Draw</strong>, an independent developer based in Vietnam.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Description of Service</h2>
            <p className="text-gray-600 leading-relaxed">
              Ad Creative AI is a personal internal tool for monitoring Google App Campaign performance and generating ad copy variants for my own mobile apps. It connects to my Google Ads accounts via the Google Ads API (read-only) to retrieve and display campaign metrics, and uses AI to generate ad copy for Google UAC, Meta, and TikTok campaigns.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. User Accounts</h2>
            <p className="text-gray-600 leading-relaxed">
              You must sign in with a valid Google account to use the Service. You are responsible for maintaining the security of your account and for all activities that occur under it. You agree to provide accurate information and to notify us immediately of any unauthorized use.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Google Ads Integration</h2>
            <p className="text-gray-600 leading-relaxed mb-3">
              When you connect a Google Ads account, you authorize the Service to access your Google Ads data via the Google Ads API. This access is:
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-2 leading-relaxed mb-3">
              <li><strong>Read-only</strong> — we retrieve campaign performance data only</li>
              <li><strong>Limited in scope</strong> — we do not create, modify, pause, or delete any campaigns, ad groups, or ads</li>
              <li><strong>Revocable</strong> — you may disconnect your account at any time from the Settings page</li>
            </ul>
            <p className="text-gray-600 leading-relaxed">
              You are responsible for ensuring your use of the Service complies with Google Ads policies and the Google Ads API Terms of Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Acceptable Use</h2>
            <p className="text-gray-600 leading-relaxed mb-3">You agree not to:</p>
            <ul className="list-disc list-inside text-gray-600 space-y-2 leading-relaxed">
              <li>Use the Service to generate content that is illegal, harmful, deceptive, or violates any third-party platform&apos;s policies</li>
              <li>Attempt to reverse-engineer, scrape, or extract data from the Service in an automated manner</li>
              <li>Use the Service to infringe on intellectual property rights of others</li>
              <li>Resell or sublicense access to the Service without prior written consent</li>
              <li>Attempt to gain unauthorized access to the Service or its underlying infrastructure</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. AI-Generated Content</h2>
            <p className="text-gray-600 leading-relaxed">
              The ad copy generated by the Service is produced by an AI model (Anthropic Claude). You are solely responsible for reviewing, editing, and ensuring that any generated content complies with applicable laws and platform advertising policies before use. We make no guarantee that generated content will be approved by any advertising platform.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Intellectual Property</h2>
            <p className="text-gray-600 leading-relaxed">
              You retain ownership of the inputs you provide (app descriptions, prompts) and the generated outputs. The Service, its design, and underlying code are owned by the developer. You are granted a limited, non-exclusive license to use the Service for its intended purposes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Disclaimer of Warranties</h2>
            <p className="text-gray-600 leading-relaxed">
              The Service is provided &quot;as is&quot; without warranties of any kind, express or implied. We do not warrant that the Service will be uninterrupted, error-free, or that the generated content will meet your requirements or achieve any particular advertising result. Use of the Service is at your own risk.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Limitation of Liability</h2>
            <p className="text-gray-600 leading-relaxed">
              To the maximum extent permitted by law, the developer shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Service, including but not limited to ad spend losses, account suspensions by third-party platforms, or reliance on AI-generated content.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Service Availability and Changes</h2>
            <p className="text-gray-600 leading-relaxed">
              We reserve the right to modify, suspend, or discontinue the Service at any time without notice. We may update these Terms from time to time. Continued use of the Service after changes constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Governing Law</h2>
            <p className="text-gray-600 leading-relaxed">
              These Terms are governed by the laws of Vietnam. Any disputes shall be resolved in the competent courts of Vietnam.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">12. Contact</h2>
            <p className="text-gray-600">
              For questions about these Terms, contact:<br />
              <strong>AR-Draw Studio</strong><br />
              Email:{' '}
              <a href="mailto:contact@ar-draw.com" className="text-blue-600 hover:underline">
                contact@ar-draw.com
              </a><br />
              Address: Ha Noi, Vietnam
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-gray-100 px-6 py-6">
        <div className="max-w-3xl mx-auto flex items-center gap-6 text-xs text-gray-400">
          <span>© 2026 AR-Draw Studio</span>
          <Link href="/about" className="hover:text-gray-600 transition-colors">About</Link>
          <Link href="/privacy" className="hover:text-gray-600 transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-gray-600 transition-colors">Terms of Service</Link>
        </div>
      </footer>
    </div>
  )
}
