import { useState } from 'react'
import { Link } from 'react-router-dom'
import { usePurchases } from '../lib/PurchasesContext.jsx'
import { useSettings } from '../lib/SettingsContext.jsx'
import { getAlerts } from '../lib/derive.js'
import { IconCheck, IconChevronRight } from '../components/Icons.jsx'
import Thumb from '../components/Thumb.jsx'
import EmptyState from '../components/EmptyState.jsx'

const DISMISSED_KEY = 'proofback.alerts.dismissed.v1'

function loadDismissed() {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]'))
  } catch {
    return new Set()
  }
}

function saveDismissed(set) {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...set]))
}

// A persistent, dismissible in-app feed — unlike notify.js's ephemeral OS
// notification (one batched alert per app session), this list stays until
// the user clears an item or the underlying condition changes. Dismissing
// just hides that specific alert id; if the same purchase later crosses a
// new threshold (e.g. 30 days -> 7 days), it gets a new id and reappears.
export default function Alerts() {
  const { purchases } = usePurchases()
  const { settings } = useSettings()
  const [dismissed, setDismissed] = useState(loadDismissed)

  const alerts = getAlerts(purchases, settings).filter((a) => !dismissed.has(a.id))

  function dismiss(id) {
    setDismissed((prev) => {
      const next = new Set(prev)
      next.add(id)
      saveDismissed(next)
      return next
    })
  }

  return (
    <div className="screen">
      <div className="page-header">
        <h1>Alerts</h1>
        <p className="page-header__sub">Return deadlines, warranty expirations, and anything else worth knowing.</p>
      </div>

      {alerts.length === 0 ? (
        <EmptyState icon={IconCheck} title="No alerts right now" detail="You're all caught up." />
      ) : (
        <div className="list">
          {alerts.map((a) => (
            <div className={'alert-row' + (a.urgent ? ' is-urgent' : '')} key={a.id}>
              <Thumb purchase={a.purchase} />
              <Link to={`/purchases/${a.purchase.id}`} className="alert-row__main">
                <div className="alert-row__message">{a.message}</div>
                <span className="alert-row__view">
                  View <IconChevronRight width={14} height={14} />
                </span>
              </Link>
              <button className="alert-row__dismiss" onClick={() => dismiss(a.id)} aria-label="Dismiss">
                <IconCheck width={14} height={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
