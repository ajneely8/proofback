import { useNavigate } from 'react-router-dom'
import { IconChevronLeft, IconCheck } from '../../components/Icons.jsx'

// ProofBack has no paid tiers right now — Stripe and the old Free/Pro/
// Family paywall were removed. Every feature listed here is just what the
// app actually does today, not a sales pitch for an upgrade that doesn't
// exist. If a payment system comes back later (Apple IAP, Stripe, or
// both), this screen is the natural place for it to live again.
const FEATURES = [
  'Unlimited receipt scans',
  'Return, refund, and warranty tracking',
  'Recall alerts',
  'Price Finder — compare prices across major retailers',
  'Price Watch and Digital Receipt Inbox',
]

export default function Subscription() {
  const navigate = useNavigate()

  return (
    <div className="screen">
      <button className="back-link" onClick={() => navigate(-1)}>
        <IconChevronLeft />
        Back
      </button>

      <div className="page-header">
        <h1>Subscription</h1>
        <p className="page-header__sub">ProofBack is free — every feature is available on your account.</p>
      </div>

      <section className="pricing-card is-current">
        <div className="pricing-card__head">
          <div className="pricing-card__name">Free</div>
          <div className="pricing-card__price">
            $0<span className="pricing-card__period">/month</span>
          </div>
        </div>
        <ul className="pricing-card__features">
          {FEATURES.map((f) => (
            <li key={f}>
              <IconCheck width={14} height={14} />
              {f}
            </li>
          ))}
        </ul>
        <div className="pricing-card__current">Current plan</div>
      </section>
    </div>
  )
}
