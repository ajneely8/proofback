import { Link } from 'react-router-dom'
import { usePurchases } from '../lib/PurchasesContext.jsx'
import { useSettings } from '../lib/SettingsContext.jsx'
import { getNeedsAttention, totalRecoverable, formatMoney } from '../lib/derive.js'
import { IconPlus, IconCamera, IconChevronRight } from '../components/Icons.jsx'
import Thumb from '../components/Thumb.jsx'

export default function Home() {
  const { purchases } = usePurchases()
  const { settings } = useSettings()
  const needsAttention = getNeedsAttention(purchases, settings.notifications)
  const total = totalRecoverable(purchases, settings.notifications)

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
          <p className="empty-note">Nothing needs your attention right now.</p>
        ) : (
          <div className="list">
            {needsAttention.map((item) => (
              <Link to={`/purchases/${item.purchase.id}`} key={item.id} className="list-row">
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
                <div className="list-row__action">
                  View
                  <IconChevronRight />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
