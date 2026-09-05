import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext.jsx'
import { usePurchases } from '../lib/PurchasesContext.jsx'
import { loadPurchases as loadLocalPurchases } from '../lib/storage.js'
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
  IconUpload,
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
  const { user, signOut } = useAuth()
  const { addPurchase, purchases } = usePurchases()
  const [importStatus, setImportStatus] = useState(null)

  function handleSignOut() {
    if (!window.confirm('Sign out of ProofBack?')) return
    signOut()
  }

  async function handleImport() {
    const local = loadLocalPurchases()
    if (!local.length) {
      setImportStatus('empty')
      return
    }
    setImportStatus('importing')
    const existingIds = new Set(purchases.map((p) => p.id))
    const toImport = local.filter((p) => !existingIds.has(p.id))
    await Promise.all(toImport.map((p) => addPurchase(p)))
    setImportStatus(`imported:${toImport.length}`)
  }

  return (
    <div className="screen">
      <div className="page-header">
        <h1>Profile</h1>
      </div>

      <div className="privacy-note">
        <IconShield />
        <span>Signed in as {user?.email}</span>
      </div>

      <section className="detail-card">
        <div className="detail-card__label">Import from this device</div>
        <p className="field-hint" style={{ textAlign: 'left', margin: '0 0 12px' }}>
          Purchases saved on this device before you had an account aren't automatically part of
          it — this brings them in without duplicating anything already here.
        </p>
        <button className="btn btn--secondary btn--block" onClick={handleImport} disabled={importStatus === 'importing'}>
          <IconUpload width={16} height={16} />
          {importStatus === 'importing' ? 'Importing…' : 'Import Purchases From This Device'}
        </button>
        {importStatus === 'empty' && <p className="field-hint">No local purchases found on this device.</p>}
        {importStatus?.startsWith('imported:') && (
          <p className="field-hint field-hint--good">
            Imported {importStatus.split(':')[1]} purchase{importStatus.split(':')[1] === '1' ? '' : 's'}.
          </p>
        )}
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
