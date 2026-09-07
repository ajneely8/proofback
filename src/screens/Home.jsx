import { Link, useNavigate } from 'react-router-dom'
import { usePurchases } from '../lib/PurchasesContext.jsx'
import { useSettings } from '../lib/SettingsContext.jsx'
import {
  getRecoveryCases,
  getRecoverableTotal,
  getYourImpact,
  getWarrantyState,
  caseActionLabel,
  formatMoney,
  formatDate,
  productLabel,
} from '../lib/derive.js'
import { IconPlus, IconCheck, IconCamera } from '../components/Icons.jsx'
import Thumb from '../components/Thumb.jsx'
import EmptyState from '../components/EmptyState.jsx'

export default function Home() {
  const navigate = useNavigate()
  const { purchases } = usePurchases()
  const { settings } = useSettings()

  // Recoverable Now is specifically about money — exchange opportunities
  // (amount always $0, since nothing's being recovered) belong in the
  // eligibility engine generally but would look like a broken $0.00 row
  // here, so they're left out of this particular list.
  const cases = getRecoveryCases(purchases, settings).filter((c) => c.status !== 'closed' && c.type !== 'exchange')
  const recoverableTotal = getRecoverableTotal(purchases, settings)
  const impact = getYourImpact(purchases)
  const activeWarranties = purchases.filter((p) => getWarrantyState(p, settings) === 'active').length
  const warrantiesExpiringSoon = purchases.filter((p) => getWarrantyState(p, settings) === 'expiring_soon').length

  return (
    <div className="screen">
      <div className="page-header">
        <div className="page-header__brand">
          <span className="brand-icon" />
          <span><span className="brand-word">Proof</span><span className="brand-word brand-word--accent">Back</span></span>
        </div>
      </div>

      <section className="summary">
        <div className="summary__label">Recoverable Now</div>
        <div className="summary__amount">{formatMoney(recoverableTotal)}</div>
        <div className="summary__hint">Across returns, missing refunds, and possible duplicate purchases</div>
      </section>

      <section className="section">
        <div className="section__title">Your Impact</div>
        <div className="dashboard-grid">
          <div className="dashboard-tile">
            <div className="dashboard-tile__value">{formatMoney(impact.totalSaved)}</div>
            <div className="dashboard-tile__label">Money saved</div>
            <div className="dashboard-tile__caption">From completed returns and received refunds</div>
          </div>
          <div className="dashboard-tile">
            <div className="dashboard-tile__value">{formatMoney(impact.totalRecovered)}</div>
            <div className="dashboard-tile__label">Money recovered</div>
            <div className="dashboard-tile__caption">Confirmed refund/return amounts</div>
          </div>
          <div className="dashboard-tile">
            <div className="dashboard-tile__value">{impact.protectedCount}</div>
            <div className="dashboard-tile__label">Purchases protected</div>
            <div className="dashboard-tile__caption">Proof Readiness of 60% or higher</div>
          </div>
          <div className="dashboard-tile">
            <div className="dashboard-tile__value">{impact.completedClaims}</div>
            <div className="dashboard-tile__label">Completed claims</div>
            <div className="dashboard-tile__caption">Returns, refunds, or cases marked resolved</div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="dashboard-grid">
          <Link to="/purchases?filter=Active" className="dashboard-tile">
            <div className="dashboard-tile__value">{activeWarranties}</div>
            <div className="dashboard-tile__label">Active warranties</div>
          </Link>
          <Link to="/purchases?filter=Expiring Soon" className="dashboard-tile">
            <div className="dashboard-tile__value">{warrantiesExpiringSoon}</div>
            <div className="dashboard-tile__label">Warranties expiring soon</div>
          </Link>
        </div>
      </section>

      <div className="action-row">
        <Link to="/add" className="btn btn--primary btn--block">
          <IconPlus />
          Add Purchase
        </Link>
      </div>

      {cases.length === 0 ? (
        <EmptyState
          icon={IconCheck}
          title="Nothing to recover right now"
          detail="Scan a receipt to start tracking a purchase's return window and warranty."
          action={
            <Link to="/add" className="btn btn--primary btn--small">
              <IconCamera width={16} height={16} />
              Scan Receipt
            </Link>
          }
        />
      ) : (
        <div className="list">
          {cases.map((c) => (
            <div className="case-row" key={c.id}>
              <Link to={`/purchases/${c.purchase.id}`} className="case-row__top">
                <Thumb purchase={c.purchase} />
                <div className="list-row__main">
                  <div className="list-row__title">{productLabel(c.purchase)}</div>
                  <div className="list-row__line">{c.eligibilityReason}</div>
                </div>
                <div className="list-row__trailing">
                  <div className="list-row__price">{formatMoney(c.amount)}</div>
                  {c.deadline && <div className="list-row__line">{formatDate(c.deadline)}</div>}
                </div>
              </Link>
              <button
                className="btn btn--secondary btn--small btn--block case-row__action"
                onClick={() => navigate(`/purchases/${c.purchase.id}`)}
              >
                {caseActionLabel(c)}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
