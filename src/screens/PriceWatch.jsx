import { useNavigate } from 'react-router-dom'
import { usePurchases } from '../lib/PurchasesContext.jsx'
import { getPriceWatchItems, getPriceWatchSummary, formatMoney, formatDate, productLabel } from '../lib/derive.js'
import { IconChevronLeft, IconTarget } from '../components/Icons.jsx'
import Thumb from '../components/Thumb.jsx'
import EmptyState from '../components/EmptyState.jsx'

const STATUS_LABEL = {
  not_checked: 'Not checked yet',
  dropped: 'Price Dropped',
  increased: 'Price Increased',
  no_change: 'No Change',
  lower_found: 'Lower Price Found',
}

export default function PriceWatch() {
  const navigate = useNavigate()
  const { purchases } = usePurchases()

  const items = getPriceWatchItems(purchases)
  const summary = getPriceWatchSummary(items)

  return (
    <div className="screen">
      <button className="back-link" onClick={() => navigate(-1)}>
        <IconChevronLeft />
        Back
      </button>

      <div className="page-header">
        <h1>Price Watch</h1>
        <p className="page-header__sub">
          Price checking isn't connected yet — Price Watch is tracking your eligible purchases and will start
          comparing prices automatically once it is.
        </p>
      </div>

      <section className="summary">
        <div className="summary__label">Potential Savings</div>
        <div className="summary__amount">{formatMoney(summary.potentialSavings)}</div>
        <div className="price-watch-counts">
          <span>{summary.trackedCount} Products Tracked</span>
          <span>{summary.priceDrops} Price Drops</span>
          <span>{summary.lowerPricesFound} Lower Prices Found</span>
        </div>
      </section>

      {items.length === 0 ? (
        <EmptyState
          icon={IconTarget}
          title="Nothing to track yet"
          detail="Scan a receipt for a physical product (electronics, apparel, home goods) and it'll show up here."
        />
      ) : (
        <div className="list">
          {items.map((item) => (
            <button
              key={item.purchase.id}
              className="list-row list-row--simple price-watch-row"
              onClick={() => navigate(`/price-watch/${item.purchase.id}`)}
            >
              <Thumb purchase={item.purchase} />
              <div className="list-row__main">
                <div className="list-row__title">{productLabel(item.purchase)}</div>
                <div className="list-row__line">
                  {item.purchase.store} · {formatDate(item.purchase.purchaseDate)}
                </div>
              </div>
              <div className="list-row__trailing">
                <div className="list-row__price">{formatMoney(item.purchase.price)}</div>
                <div className={`price-watch-status price-watch-status--${item.status}`}>
                  {STATUS_LABEL[item.status]}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
