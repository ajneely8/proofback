import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext.jsx'
import { useSettings } from '../../lib/SettingsContext.jsx'
import { usePurchases } from '../../lib/PurchasesContext.jsx'
import { IconChevronLeft, IconCheck } from '../../components/Icons.jsx'

const UPGRADE_ERROR_MESSAGES = {
  accounts_not_configured: 'Accounts need to be set up before a paid plan can work.',
  stripe_not_configured: "This plan isn't available for purchase yet — check back soon.",
  checkout_failed: "Couldn't start checkout. Try again in a moment.",
}

const TIERS = [
  {
    key: 'free',
    name: 'Free',
    price: '$0',
    period: '/month',
    features: ['Up to 10 purchases', 'Receipt scanning', 'Basic search', 'Basic return tracking'],
  },
  {
    key: 'pro',
    name: 'Pro',
    price: '$5.99',
    annualPrice: '$59',
    period: '/month',
    features: [
      'Unlimited purchases',
      'Digital receipt importing',
      'Automatic return tracking',
      'Warranty tracking',
      'Product ownership records',
      'Recall alerts',
      'Product resources',
      'Cloud backup',
      'Advanced search',
    ],
  },
  {
    key: 'family',
    name: 'Family',
    price: '$9.99',
    annualPrice: '$99',
    period: '/month',
    features: [
      'Everything in Pro',
      'Multiple household members',
      'Shared purchases',
      'Shared warranties',
      'Household purchase dashboard',
      'Family protection alerts',
    ],
  },
]

export default function Subscription() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const { settings, updateSettings } = useSettings()
  const { purchases } = usePurchases()
  const [billing, setBilling] = useState('monthly')
  const [upgrading, setUpgrading] = useState(null)
  const [upgradeError, setUpgradeError] = useState(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const checkoutResult = searchParams.get('checkout')

  async function handleUpgrade(tier) {
    setUpgrading(tier)
    setUpgradeError(null)
    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ tier }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) {
        setUpgradeError(UPGRADE_ERROR_MESSAGES[data.error] || 'Something went wrong. Try again.')
        setUpgrading(null)
        return
      }
      window.location.href = data.url
    } catch {
      setUpgradeError('Something went wrong. Try again.')
      setUpgrading(null)
    }
  }

  return (
    <div className="screen">
      <button className="back-link" onClick={() => navigate(-1)}>
        <IconChevronLeft />
        Back
      </button>

      <div className="page-header">
        <h1>Subscription</h1>
        <p className="page-header__sub">
          Free covers the basics. Pro and Family unlock full protection — unlimited purchases, automatic tracking,
          and recall alerts.
        </p>
      </div>

      {checkoutResult === 'success' && (
        <p className="field-hint field-hint--good">
          Payment received — your plan activates as soon as it's confirmed (usually a few seconds).
        </p>
      )}
      {checkoutResult === 'cancelled' && <p className="field-hint">Checkout cancelled — no charge was made.</p>}
      {upgradeError && <p className="field-hint">{upgradeError}</p>}

      <div className="segmented" style={{ marginBottom: 16 }}>
        <button
          className={'segmented__option' + (billing === 'monthly' ? ' is-active' : '')}
          onClick={() => setBilling('monthly')}
        >
          Monthly
        </button>
        <button
          className={'segmented__option' + (billing === 'annual' ? ' is-active' : '')}
          onClick={() => setBilling('annual')}
        >
          Annual (save ~15%)
        </button>
      </div>

      {TIERS.map((tier) => {
        const isCurrent = (settings.plan || 'free') === tier.key
        return (
          <section className={'pricing-card' + (isCurrent ? ' is-current' : '')} key={tier.key}>
            <div className="pricing-card__head">
              <div className="pricing-card__name">{tier.name}</div>
              <div className="pricing-card__price">
                {billing === 'annual' && tier.annualPrice ? tier.annualPrice : tier.price}
                <span className="pricing-card__period">{billing === 'annual' && tier.annualPrice ? '/year' : tier.period}</span>
              </div>
            </div>
            <ul className="pricing-card__features">
              {tier.features.map((f) => (
                <li key={f}>
                  <IconCheck width={14} height={14} />
                  {f}
                </li>
              ))}
            </ul>
            {isCurrent ? (
              <div className="pricing-card__current">
                Current plan
                {tier.key === 'free' && (
                  <span className="field-hint" style={{ margin: '4px 0 0' }}>
                    {purchases.length} of 10 purchases used
                  </span>
                )}
              </div>
            ) : tier.key === 'free' ? (
              <button
                className="btn btn--secondary btn--block"
                onClick={() => updateSettings({ plan: 'free' })}
              >
                Downgrade to Free
              </button>
            ) : (
              <button
                className="btn btn--primary btn--block"
                onClick={() => handleUpgrade(tier.key)}
                disabled={upgrading === tier.key}
              >
                {upgrading === tier.key ? 'Redirecting…' : `Upgrade to ${tier.name}`}
              </button>
            )}
          </section>
        )
      })}

      <button
        className="link-action"
        onClick={() => {
          const order = ['free', 'pro', 'family']
          const next = order[(order.indexOf(settings.plan || 'free') + 1) % order.length]
          updateSettings({ plan: next })
          setSearchParams({})
        }}
      >
        Cycle plan (dev test)
      </button>
    </div>
  )
}
