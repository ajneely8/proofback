import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext.jsx'
import { useSettings } from '../lib/SettingsContext.jsx'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient.js'

const UPGRADE_ERROR_MESSAGES = {
  accounts_not_configured: 'Accounts need to be set up before Premium can work.',
  stripe_not_configured: "Payment isn't set up on the server yet.",
  checkout_failed: "Couldn't start checkout. Try again in a moment.",
}
import {
  IconUser,
  IconBell,
  IconMail,
  IconLock,
  IconCard,
  IconHelp,
  IconDoc,
  IconLogout,
  IconChevronRight,
  IconShield,
  IconClock,
} from '../components/Icons.jsx'

const ROWS = [
  { Icon: IconUser, label: 'Account', to: '/profile/account' },
  { Icon: IconClock, label: 'History', to: '/profile/history' },
  { Icon: IconBell, label: 'Notification settings', to: '/profile/notifications' },
  { Icon: IconMail, label: 'Email connections', to: '/profile/email' },
  { Icon: IconLock, label: 'Privacy', to: '/profile/privacy' },
  { Icon: IconCard, label: 'Subscription', to: '/profile/subscription' },
  { Icon: IconHelp, label: 'Help', to: '/profile/help' },
  { Icon: IconDoc, label: 'Terms', to: '/profile/terms' },
]

export default function Profile() {
  const { user, session, signOut } = useAuth()
  const { settings, updateSettings } = useSettings()
  const [scansUsed, setScansUsed] = useState(null)
  const [upgrading, setUpgrading] = useState(false)
  const [upgradeError, setUpgradeError] = useState(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const checkoutResult = searchParams.get('checkout')

  useEffect(() => {
    if (!isSupabaseConfigured || !user || settings.plan === 'premium') {
      setScansUsed(null)
      return
    }
    const month = new Date().toISOString().slice(0, 7)
    supabase
      .from('scan_usage')
      .select('count')
      .eq('user_id', user.id)
      .eq('month', month)
      .maybeSingle()
      .then(({ data }) => setScansUsed(data?.count || 0))
  }, [user, settings.plan])

  function handleSignOut() {
    if (!window.confirm('Sign out of ProofBack?')) return
    signOut()
  }

  async function handleUpgrade() {
    setUpgrading(true)
    setUpgradeError(null)
    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      })
      const data = await res.json()
      if (!res.ok || !data.url) {
        setUpgradeError(UPGRADE_ERROR_MESSAGES[data.error] || 'Something went wrong. Try again.')
        setUpgrading(false)
        return
      }
      window.location.href = data.url
    } catch {
      setUpgradeError('Something went wrong. Try again.')
      setUpgrading(false)
    }
  }

  return (
    <div className="screen">
      <div className="page-header">
        <h1>Profile</h1>
      </div>

      <div className="privacy-note">
        <IconShield />
        <span>{user?.email ? `Signed in as ${user.email}` : 'Your purchases are stored locally on this device'}</span>
      </div>

      <section className="detail-card">
        <div className="detail-card__label">Plan</div>
        <div className="detail-card__row">
          <span>Current plan</span>
          <strong className={settings.plan === 'premium' ? 'text-accent' : ''}>
            {settings.plan === 'premium' ? 'Premium' : 'Free'}
          </strong>
        </div>
        {settings.plan !== 'premium' && scansUsed != null && (
          <div className="detail-card__row">
            <span>Scans this month</span>
            <strong>{scansUsed} of 5</strong>
          </div>
        )}
        <p className="field-hint" style={{ textAlign: 'left', margin: '6px 0 12px' }}>
          {settings.plan === 'premium'
            ? 'Unlimited scans and email reminders are on.'
            : 'Free plan: 5 scans/month. Premium unlocks unlimited scans and email reminders.'}
        </p>

        {checkoutResult === 'success' && (
          <p className="field-hint field-hint--good">
            Payment received — Premium activates as soon as it's confirmed (usually a few seconds).
          </p>
        )}
        {checkoutResult === 'cancelled' && <p className="field-hint">Checkout cancelled — no charge was made.</p>}

        {settings.plan !== 'premium' && (
          <button className="btn btn--primary btn--block" onClick={handleUpgrade} disabled={upgrading}>
            {upgrading ? 'Redirecting…' : 'Upgrade to Premium'}
          </button>
        )}
        {upgradeError && <p className="field-hint">{upgradeError}</p>}

        <button
          className="link-action"
          onClick={() => {
            updateSettings({ plan: settings.plan === 'premium' ? 'free' : 'premium' })
            setSearchParams({})
          }}
        >
          {settings.plan === 'premium' ? 'Switch to Free (dev test)' : 'Switch to Premium (dev test)'}
        </button>
      </section>

      <section className="detail-card">
        <div className="detail-card__label">Appearance</div>
        <div className="segmented">
          {['light', 'system', 'dark'].map((option) => (
            <button
              key={option}
              className={'segmented__option' + (settings.theme === option ? ' is-active' : '')}
              onClick={() => updateSettings({ theme: option })}
            >
              {option === 'system' ? 'System' : option === 'light' ? 'Light' : 'Dark'}
            </button>
          ))}
        </div>
      </section>

      <div className="list">
        {ROWS.map(({ Icon, label, to }) => (
          <Link className="settings-row" key={label} to={to}>
            <Icon />
            <span>{label}</span>
            <IconChevronRight className="settings-row__chevron" />
          </Link>
        ))}
        <button className="settings-row settings-row--danger" onClick={handleSignOut}>
          <IconLogout />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  )
}
