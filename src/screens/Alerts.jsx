import { useState } from 'react'
import { Link } from 'react-router-dom'
import { usePurchases } from '../lib/PurchasesContext.jsx'
import { useSettings } from '../lib/SettingsContext.jsx'
import { getAlerts, productLabel } from '../lib/derive.js'
import { IconCheck, IconChevronRight } from '../components/Icons.jsx'
import Thumb from '../components/Thumb.jsx'
import EmptyState from '../components/EmptyState.jsx'

const DISMISSED_KEY = 'proofback.alerts.dismissed.v1'

const RECOVERY_CASE_LABELS = { evidence_ready: 'evidence ready to submit', submitted: 'submitted, awaiting a response' }
const WARRANTY_CLAIM_LABELS = {
  draft: 'still in draft',
  evidence_ready: 'evidence ready to submit',
  submitted: 'submitted, awaiting a response',
  in_review: 'in review',
}

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

// A prioritized Action Center — return/warranty/refund alerts from
// getAlerts() (threshold-based, so they naturally clear once the underlying
// date is no longer close) plus purchases with a claim the user has
// actively started and hasn't finished yet, so nothing gets forgotten
// mid-claim. A persistent, dismissible list (unlike notify.js's ephemeral
// OS notification) — dismissing just hides that one id; if the same
// purchase crosses a new threshold or its claim moves to a new status, it
// gets a new id and reappears.
export default function Alerts() {
  const { purchases } = usePurchases()
  const { settings } = useSettings()
  const [dismissed, setDismissed] = useState(loadDismissed)

  const dateAlerts = getAlerts(purchases, settings)

  const pendingClaimAlerts = []
  purchases.forEach((p) => {
    if (p.recoveryCase && RECOVERY_CASE_LABELS[p.recoveryCase.status]) {
      pendingClaimAlerts.push({
        id: `${p.id}-pending-case-${p.recoveryCase.status}`,
        purchase: p,
        urgent: false,
        daysLeft: null,
        message: `Your ${productLabel(p)} recovery case is ${RECOVERY_CASE_LABELS[p.recoveryCase.status]}.`,
      })
    }
    if (p.warrantyClaim && WARRANTY_CLAIM_LABELS[p.warrantyClaim.status]) {
      pendingClaimAlerts.push({
        id: `${p.id}-pending-claim-${p.warrantyClaim.status}`,
        purchase: p,
        urgent: false,
        daysLeft: null,
        message: `Your ${productLabel(p)} warranty claim is ${WARRANTY_CLAIM_LABELS[p.warrantyClaim.status]}.`,
      })
    }
  })

  const alerts = [...dateAlerts, ...pendingClaimAlerts].filter((a) => !dismissed.has(a.id))

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
        <p className="page-header__sub">
          Deadlines, incomplete evidence, and claims you've started that still need a next step.
        </p>
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
