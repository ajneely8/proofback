import { Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext.jsx'
import { useSettings } from '../lib/SettingsContext.jsx'
import { usePurchases } from '../lib/PurchasesContext.jsx'
import { normalizePlan, FREE_PURCHASE_LIMIT } from '../data/mockData.js'
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
  { Icon: IconCard, label: 'Connected Accounts', to: '/profile/accounts' },
  { Icon: IconMail, label: 'Receipt Inbox', to: '/inbox' },
  { Icon: IconBell, label: 'Notification settings', to: '/profile/notifications' },
  { Icon: IconMail, label: 'Email connections', to: '/profile/email' },
  { Icon: IconLock, label: 'Privacy', to: '/profile/privacy' },
  { Icon: IconCard, label: 'Subscription', to: '/profile/subscription' },
  { Icon: IconHelp, label: 'Help', to: '/profile/help' },
  { Icon: IconDoc, label: 'Terms', to: '/profile/terms' },
]

const PLAN_NAMES = { free: 'Free', pro: 'Pro', family: 'Family' }

export default function Profile() {
  const { user, signOut } = useAuth()
  const { settings } = useSettings()
  const { purchases } = usePurchases()
  const plan = normalizePlan(settings.plan)

  function handleSignOut() {
    if (!window.confirm('Sign out of ProofBack?')) return
    signOut()
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
          <strong className={plan !== 'free' ? 'text-accent' : ''}>{PLAN_NAMES[plan] || 'Free'}</strong>
        </div>
        {plan === 'free' && (
          <div className="detail-card__row">
            <span>Scans used</span>
            <strong>{purchases.length} of {FREE_PURCHASE_LIMIT}</strong>
          </div>
        )}
        <p className="field-hint" style={{ textAlign: 'left', margin: '6px 0 12px' }}>
          {plan === 'free'
            ? `Free plan: up to ${FREE_PURCHASE_LIMIT} scans. Pro and Family unlock unlimited scans, automatic return tracking, and more.`
            : 'Unlimited scans and automatic tracking are on.'}
        </p>
        <Link to="/profile/subscription" className="btn btn--primary btn--block">
          {plan === 'free' ? 'View Plans' : 'Manage Plan'}
        </Link>
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
