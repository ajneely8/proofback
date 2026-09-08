import { Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext.jsx'
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

export default function Profile() {
  const { user, signOut } = useAuth()

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
