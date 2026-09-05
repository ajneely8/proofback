import { Link } from 'react-router-dom'
import { usePurchases } from '../lib/PurchasesContext.jsx'
import { useSettings } from '../lib/SettingsContext.jsx'
import { getNeedsAttention, totalRecoverable, getTotalDiscountSaved, formatMoney, categoryColor } from '../lib/derive.js'
import { IconPlus, IconCamera, IconChevronRight, IconCheck } from '../components/Icons.jsx'
import Thumb from '../components/Thumb.jsx'
import RadialProgress from '../components/RadialProgress.jsx'
import EmptyState from '../components/EmptyState.jsx'

export default function Home() {
  const { purchases } = usePurchases()
  const { settings } = useSettings()
  const needsAttention = getNeedsAttention(purchases, settings.notifications)
  const total = totalRecoverable(purchases, settings.notifications)
  const discountSaved = getTotalDiscountSaved(purchases)

  return (
    <div className="screen">
      <div className="page-header">
        <div className="page-header__brand">
          <span className="brand-icon" />
          <span><span className="brand-word">Proof</span><span className="brand-word brand-word--accent">Back</span></span>
        </div>
      </div>

      <section className="summary">
        <div className="summary__label">Money you could recover</div>
        <div className="summary__amount">{formatMoney(total)}</div>
        <div className="summary__hint">Based on your tracked purchases</div>
      </section>

      {discountSaved > 0 && (
        <div className="stat-pill">
          <div className="stat-pill__body">
            <div className="stat-pill__label">Saved from discounts</div>
            <div className="stat-pill__amount">{formatMoney(discountSaved)}</div>
          </div>
        </div>
      )}

      <div className="action-row">
        <Link to="/add" className="btn btn--primary">
          <IconPlus />
          Add Purchase
        </Link>
        <Link to="/add" className="btn btn--secondary">
          <IconCamera width={18} height={18} />
          Scan Receipt
        </Link>
      </div>

      <section className="section">
        <div className="section__title">Needs attention</div>

        {needsAttention.length === 0 ? (
          <EmptyState
            icon={IconCheck}
            title="Nothing needs your attention"
            detail="Return windows, warranties, and refunds are all caught up."
          />
        ) : (
          <div className="list">
            {needsAttention.map((item) => (
              <Link
                to={`/purchases/${item.purchase.id}`}
                key={item.id}
                className="list-row"
                style={{ '--row-accent': categoryColor(item.purchase.category) }}
              >
                <Thumb purchase={item.purchase} />
                <div className="list-row__main">
                  <div className="list-row__title">{item.label}</div>
                  <div className="list-row__price">{formatMoney(item.purchase.price)}</div>
                  <div className={'list-row__line' + (item.urgent ? ' is-urgent' : '')}>
                    {item.primaryText}
                  </div>
                  {item.secondaryText && (
                    <div className="list-row__line list-row__line--accent">{item.secondaryText}</div>
                  )}
                </div>
                <div className="list-row__action list-row__action--stacked">
                  {item.daysLeft != null && (
                    <RadialProgress daysLeft={item.daysLeft} windowDays={item.windowDays} urgent={item.urgent} />
                  )}
                  <span className="list-row__view">
                    View
                    <IconChevronRight />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
