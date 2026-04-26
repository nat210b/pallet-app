import { useNavigate } from 'react-router-dom'
import './LandingPageStyle.css'

const FEATURES = [
  { icon: '📦', title: '3D Interactive Placement',
    desc: 'Drag and snap boxes onto the pallet in real-time 3D with intuitive controls.' },
  { icon: '📐', title: 'Custom Dimensions',
    desc: 'Define exact box and pallet dimensions to match your real-world cargo.' },
  { icon: '🔄', title: 'Rotation & Snapping',
    desc: 'Rotate boxes freely and snap them edge-to-edge for perfect, stable stacking.' },
  { icon: '⚠️', title: 'Height Limit Alerts',
    desc: 'A glowing red plane appears the moment your stack exceeds the maximum height.' },
  { icon: '📊', title: 'Real-time Analytics',
    desc: 'Live counter tracking box count, volume utilization, and packing efficiency.' },
  { icon: '🚀', title: 'Performance Optimized',
    desc: 'Built with R3F best practices — smooth even with dozens of boxes on screen.' },
]

const PLANS = [
  {
    tier: 'Free', price: '$0', period: '/month',
    desc: 'Perfect for evaluating the tool.',
    items: [
      { t: 'Up to 20 boxes per session', ok: true },
      { t: '1 pallet configuration', ok: true },
      { t: 'Basic 3D visualization', ok: true },
      { t: 'Export to PDF', ok: false },
      { t: 'API access', ok: false },
      { t: 'Team collaboration', ok: false },
    ],
    btn: 'Get Started', btnCls: 'line',
  },
  {
    tier: 'Pro', price: '$29', period: '/month', hot: true,
    desc: 'For logistics teams that ship daily.',
    items: [
      { t: 'Unlimited boxes per session', ok: true },
      { t: 'Unlimited pallet configs', ok: true },
      { t: 'Full 3D visualization', ok: true },
      { t: 'Export to PDF & Excel', ok: true },
      { t: 'API access (1,000 req/mo)', ok: true },
      { t: 'Team collaboration', ok: false },
    ],
    btn: 'Start Free Trial', btnCls: 'solid',
  },
  {
    tier: 'Enterprise', price: 'Custom', period: '',
    desc: 'For large-scale warehouse operations.',
    items: [
      { t: 'Everything in Pro', ok: true },
      { t: 'Unlimited API access', ok: true },
      { t: 'Team collaboration', ok: true },
      { t: 'SSO & audit logs', ok: true },
      { t: 'Dedicated support', ok: true },
      { t: 'Custom integrations', ok: true },
    ],
    btn: 'Contact Sales', btnCls: 'line',
  },
]

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div>
      {/* NAV */}
      <nav className="lp-nav">
        <div className="lp-nav-logo">PalletX</div>
        <button className="lp-nav-cta" onClick={() => navigate('/calculator')}>
          Try Calculator
        </button>
      </nav>

      {/* HERO */}
      <section className="lp-hero">
        <div className="lp-hero-bg" />
        <div className="lp-hero-grid" />
        <div className="lp-hero-content">
          <div className="lp-hero-badge">3D Logistics Intelligence</div>
          <h1>
            Load Smarter.<br />
            Ship <span>Less Air</span>.
          </h1>
          <p>
            PalletX is the interactive 3D pallet loading calculator built for
            modern logistics teams. Visualize, optimize, and maximize every
            centimeter of your cargo space.
          </p>
          <div className="lp-hero-btns">
            <button className="btn-primary" onClick={() => navigate('/calculator')}>
              Try Calculator Now →
            </button>
            <button className="btn-ghost">Watch Demo</button>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="lp-features">
        <div className="lp-section-tag">Features</div>
        <div className="lp-section-h">Everything you need to load perfectly.</div>
        <div className="lp-section-sub">
          From 3D drag-and-drop to automated height warnings — PalletX covers
          the full loading workflow.
        </div>
        <div className="lp-features-grid">
          {FEATURES.map(f => (
            <div className="lp-fcard" key={f.title}>
              <div className="lp-fcard-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section className="lp-pricing">
        <div className="lp-pricing-inner">
          <div className="lp-section-tag">Pricing</div>
          <div className="lp-section-h">Simple, transparent pricing.</div>
          <div className="lp-section-sub">Start free. Scale as your operations grow.</div>
          <div className="lp-plans">
            {PLANS.map(p => (
              <div className={`lp-plan${p.hot ? ' hot' : ''}`} key={p.tier}>
                {p.hot && <div className="lp-plan-badge">Most Popular</div>}
                <div className="lp-plan-tier">{p.tier}</div>
                <div className="lp-plan-price">
                  {p.price}<span>{p.period}</span>
                </div>
                <div className="lp-plan-desc">{p.desc}</div>
                <ul>
                  {p.items.map(i => (
                    <li key={i.t}>
                      <span className={i.ok ? 'ok' : 'no'}>{i.ok ? '✓' : '✗'}</span>
                      {i.t}
                    </li>
                  ))}
                </ul>
                <button
                  className={`lp-plan-btn ${p.btnCls}`}
                  onClick={() => p.hot && navigate('/calculator')}
                >
                  {p.btn}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="lp-footer">
        <strong>PalletX</strong> © {new Date().getFullYear()} — Smarter loading for modern logistics.
      </footer>
    </div>
  )
}
