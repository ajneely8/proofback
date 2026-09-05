import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSettings } from '../../lib/SettingsContext.jsx'
import { IconChevronLeft } from '../../components/Icons.jsx'
import { getNotificationPermission, requestNotificationPermission } from '../../lib/notify.js'

const TOGGLES = [
  {
    key: 'returnDeadlines',
    label: 'Return deadlines',
    detail: 'Alerts as a return window is about to close.',
  },
  {
    key: 'priceDrops',
    label: 'Price drops',
    detail: 'Alerts when a tracked item is now cheaper than what you paid.',
  },
  {
    key: 'refundAlerts',
    label: 'Missing refunds',
    detail: "Alerts when a refund you're owed hasn't shown up.",
  },
  {
    key: 'warrantyAlerts',
    label: 'Warranty expiration',
    detail: 'Alerts before a tracked warranty runs out.',
  },
]

const PERMISSION_COPY = {
  granted: { label: 'On', detail: "You'll get a notification when something newly needs attention, whenever you open or return to ProofBack." },
  denied: { label: 'Blocked', detail: 'Notifications were denied in your browser — re-enable them in your browser/site settings to turn this back on.' },
  default: { label: 'Off', detail: "Turn on to get an alert when something newly needs attention. Only fires while ProofBack is open or in a background tab — it can't reach you while the app is fully closed, since nothing runs on a server to watch for it." },
  unsupported: { label: 'Not supported', detail: "This browser doesn't support notifications." },
}

export default function Notifications() {
  const { settings, updateNotification, updateSettings } = useSettings()
  const navigate = useNavigate()
  const [permission, setPermission] = useState(getNotificationPermission)

  async function enableNotifications() {
    const result = await requestNotificationPermission()
    setPermission(result)
  }

  function clampDays(value, fallback) {
    const n = Math.round(Number(value))
    if (!Number.isFinite(n) || n < 1) return fallback
    return Math.min(n, 365)
  }

  const permCopy = PERMISSION_COPY[permission] || PERMISSION_COPY.default

  return (
    <div className="screen">
      <button className="back-link" onClick={() => navigate(-1)}>
        <IconChevronLeft />
        Back
      </button>

      <div className="page-header">
        <h1>Notification settings</h1>
        <p className="page-header__sub">Choose what ProofBack should surface on Home and Opportunities.</p>
      </div>

      <section className="detail-card">
        <div className="field-row">
          <label>Browser notifications</label>
          <span className="field-row__static">{permCopy.label}</span>
        </div>
        <p className="field-hint" style={{ textAlign: 'left', margin: '6px 0 0' }}>
          {permCopy.detail}
        </p>
        {permission === 'default' && (
          <button className="btn btn--primary btn--block" onClick={enableNotifications} style={{ marginTop: 12 }}>
            Enable Notifications
          </button>
        )}
      </section>

      <div className="list">
        {TOGGLES.map(({ key, label, detail }) => (
          <div className="toggle-row" key={key}>
            <div className="toggle-row__text">
              <div className="toggle-row__label">{label}</div>
              <div className="toggle-row__detail">{detail}</div>
            </div>
            <button
              className={'switch' + (settings.notifications[key] ? ' is-on' : '')}
              role="switch"
              aria-checked={settings.notifications[key]}
              onClick={() => updateNotification(key, !settings.notifications[key])}
            >
              <span className="switch__knob" />
            </button>
          </div>
        ))}
      </div>

      <div className="page-header">
        <h2 className="section__title">Reminder timing</h2>
        <p className="page-header__sub">Control how far ahead ProofBack starts flagging a deadline.</p>
      </div>

      <section className="detail-card">
        <div className="field-row">
          <label>Start reminding (days before)</label>
          <input
            type="number"
            min="1"
            max="365"
            value={settings.reminderWindowDays}
            onChange={(e) => updateSettings({ reminderWindowDays: clampDays(e.target.value, settings.reminderWindowDays) })}
          />
        </div>
        <p className="field-hint" style={{ textAlign: 'left', margin: '0 0 12px' }}>
          A return or warranty deadline shows up on Home once it's this many days away.
        </p>
        <div className="field-row">
          <label>Mark as urgent (days before)</label>
          <input
            type="number"
            min="1"
            max="365"
            value={settings.urgentWindowDays}
            onChange={(e) => updateSettings({ urgentWindowDays: clampDays(e.target.value, settings.urgentWindowDays) })}
          />
        </div>
        <p className="field-hint" style={{ textAlign: 'left', margin: '0' }}>
          Inside this many days, a deadline is flagged urgent instead of just "still returnable".
        </p>
      </section>
    </div>
  )
}
