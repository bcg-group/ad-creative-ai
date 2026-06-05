import Link from 'next/link'

const PLATFORMS = [
  {
    name: 'Meta',
    sub: 'Facebook & Instagram',
    color: 'bg-blue-50 border-blue-100',
    badge: 'bg-blue-100 text-blue-700',
    fields: [
      { label: 'Primary Text', value: 'Tired of juggling 5 apps to track your expenses? MoneyMate auto-categorizes every transaction in real time — so you always know where your money goes.' },
      { label: 'Headline', value: 'Take Control of Your Money' },
      { label: 'Description', value: 'Free. No card needed.' },
      { label: 'CTA', value: 'Get Started' },
    ],
  },
  {
    name: 'TikTok',
    sub: 'Short-form video',
    color: 'bg-pink-50 border-pink-100',
    badge: 'bg-pink-100 text-pink-700',
    fields: [
      { label: 'Hook', value: 'POV: you finally stopped ignoring your bank balance 💸' },
      { label: 'Body', value: 'MoneyMate tracks every spend automatically. took me 2 mins to set up' },
      { label: 'Hashtags', value: '#personalfinance #budgetapp #moneymate #financetips' },
    ],
  },
  {
    name: 'Google',
    sub: 'App campaigns (UAC)',
    color: 'bg-green-50 border-green-100',
    badge: 'bg-green-100 text-green-700',
    fields: [
      { label: 'Headlines', value: 'Track Every Dollar\nBudget Smarter, Save More\nJoin 2M+ Happy Users\nFree Download — No Ads\nStart Saving Today' },
      { label: 'Descriptions', value: 'Auto-categorize transactions and see exactly where your money goes every month.\nBill reminders, spending insights, and goals — all in one free app.' },
    ],
  },
]

const STEPS = [
  {
    num: '1',
    title: 'Describe your app',
    desc: 'Enter your app name, category, target audience, and key features. Or paste a store URL to auto-fill.',
  },
  {
    num: '2',
    title: 'AI writes the copy',
    desc: 'Claude generates 3 platform-tuned variants — each with a different angle: pain/solution, aspiration, FOMO.',
  },
  {
    num: '3',
    title: 'Copy or export',
    desc: 'Use the copy instantly or export to CSV for your media buyer or ad platform.',
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-gray-100 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">Ad</span>
            </div>
            <span className="text-lg font-semibold text-gray-900">Ad Creative AI</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/generate"
              className="text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Start for free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 pt-20 pb-16 text-center">
        <div className="max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
            Built for mobile app UA teams
          </div>
          <h1 className="text-5xl font-bold text-gray-900 leading-tight tracking-tight mb-5">
            Ad copy for your app.<br />Generated in seconds.
          </h1>
          <p className="text-lg text-gray-500 leading-relaxed mb-8 max-w-xl mx-auto">
            Describe your app once. Get platform-ready ad copy for Meta, TikTok, and Google UAC —
            tuned by an AI trained on high-performing mobile UA campaigns.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/generate"
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-xl transition-colors text-base"
            >
              Start generating →
            </Link>
          </div>
          <p className="text-sm text-gray-400 mt-3">Free to use. No credit card required.</p>
        </div>
      </section>

      {/* Platform examples */}
      <section className="px-6 pb-20">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-sm font-medium text-gray-400 uppercase tracking-widest mb-8">
            Example output
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            {PLATFORMS.map((p) => (
              <div key={p.name} className={`rounded-2xl border p-5 ${p.color}`}>
                <div className="flex items-center gap-2 mb-4">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${p.badge}`}>
                    {p.name}
                  </span>
                  <span className="text-xs text-gray-400">{p.sub}</span>
                </div>
                <div className="space-y-3">
                  {p.fields.map((f) => (
                    <div key={f.label}>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                        {f.label}
                      </p>
                      <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                        {f.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-gray-50 px-6 py-20">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-12">How it works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {STEPS.map((step) => (
              <div key={step.num} className="text-left">
                <div className="w-9 h-9 bg-blue-600 text-white rounded-lg flex items-center justify-center font-bold text-sm mb-4">
                  {step.num}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="px-6 py-20 text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Stop writing ad copy manually.
          </h2>
          <p className="text-gray-500 mb-8">
            Generate high-converting variants for every platform in under 30 seconds.
          </p>
          <Link
            href="/generate"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium px-8 py-3.5 rounded-xl transition-colors text-base"
          >
            Start for free →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 px-6 py-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-xs text-gray-400">
          <span>© 2026 Ad Creative AI</span>
          <Link href="/generate" className="hover:text-gray-600 transition-colors">
            Open app →
          </Link>
        </div>
      </footer>
    </div>
  )
}
