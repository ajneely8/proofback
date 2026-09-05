import { Link } from 'react-router-dom'
import { usePurchases } from '../lib/PurchasesContext.jsx'
import { useSettings } from '../lib/SettingsContext.jsx'
import { getOpportunities, formatMoney } from '../lib/derive.js'
import { IconTarget } from '../components/Icons.jsx'
import Thumb from '../components/Thumb.jsx'
import EmptyState from '../components/EmptyState.jsx'

export default function Opportunities() {
  const { purchases } = usePurchases()
  const { settings } = useSettings()
  const opportunities = getOpportunities(purchases, settings)

  return (
    <div className="screen">
      <div className="page-header">
        <h1>Opportunities</h1>
        <p className="page-header__sub">Ways ProofBack found to help you save or recover money.</p>
      </div>

      {opportunities.length === 0 ? (
        <EmptyState
          icon={IconTarget}
          title="No opportunities right now"
          detail="You're all caught up — ProofBack will surface anything new here."
        />
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
