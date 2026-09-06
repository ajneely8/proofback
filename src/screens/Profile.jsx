import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext.jsx'
import { usePurchases } from '../lib/PurchasesContext.jsx'
import { useSettings } from '../lib/SettingsContext.jsx'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient.js'
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
  const { settings, updateSettings } = useSettings()
  const [importStatus, setImportStatus] = useState(null)
  const [scansUsed, setScansUsed] = useState(null)

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
        <button
          className="btn btn--secondary btn--block"
          onClick={() => updateSettings({ plan: settings.plan === 'premium' ? 'free' : 'premium' })}
        >
          {settings.plan === 'premium' ? 'Switch to Free (test)' : 'Switch to Premium (test)'}
        </button>
        <p className="field-hint" style={{ textAlign: 'left', margin: '6px 0 0' }}>
          No real billing yet — this is a manual flag for testing until payment is wired up.
        </p>
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
