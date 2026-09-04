import { useNavigate } from 'react-router-dom'
import { useSettings } from '../../lib/SettingsContext.jsx'
import { IconChevronLeft } from '../../components/Icons.jsx'

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

export default function Notifications() {
  const { settings, updateNotification } = useSettings()
  const navigate = useNavigate()

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
    </div>
  )
}
