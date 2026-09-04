import { Link } from 'react-router-dom'
import { usePurchases } from '../lib/PurchasesContext.jsx'
import { useSettings } from '../lib/SettingsContext.jsx'
import { getOpportunities, formatMoney } from '../lib/derive.js'
import Thumb from '../components/Thumb.jsx'

export default function Opportunities() {
  const { purchases } = usePurchases()
  const { settings } = useSettings()
  const opportunities = getOpportunities(purchases, settings.notifications)

  return (
    <div className="screen">
      <div className="page-header">
        <h1>Opportunities</h1>
        <p className="page-header__sub">Ways ProofBack found to help you save or recover money.</p>
      </div>

      {opportunities.length === 0 ? (
        <p className="empty-note">No opportunities right now. You're all caught up.</p>
      ) : (
        <div className="opp-list">
          {opportunities.map((o) => (
            <div className="opp-row" key={o.id}>
              <Thumb purchase={o.purchase} />
              <div className="opp-row__body">
                <div className="opp-row__amount">{formatMoney(o.amount)}</div>
                <div className="opp-row__title">{o.title}</div>
                <div className="opp-row__detail">{o.detail}</div>
                {o.note && <div className="opp-row__note">{o.note}</div>}
                <Link to={`/purchases/${o.purchase.id}`} className="btn btn--secondary btn--small">
                  {o.action}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
