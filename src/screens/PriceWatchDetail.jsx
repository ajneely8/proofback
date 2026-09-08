import { useNavigate, useParams, Link } from 'react-router-dom'
import { usePurchases } from '../lib/PurchasesContext.jsx'
import { getPriceWatchItem, formatMoney, formatDate, productLabel, daysUntil } from '../lib/derive.js'
import { IconChevronLeft } from '../components/Icons.jsx'
import ProductImage from '../components/ProductImage.jsx'

const STATUS_LABEL = {
  not_checked: 'Not checked yet',
  dropped: 'Price Dropped',
  increased: 'Price Increased',
  no_change: 'No Change',
  lower_found: 'Lower Price Found',
}

export default function PriceWatchDetail() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { purchases } = usePurchases()
  const purchase = purchases.find((p) => p.id === id)

  if (!purchase) {
    return (
      <div className="screen">
        <p className="empty-note">Purchase not found.</p>
        <Link to="/price-watch" className="btn btn--secondary">Back to Price Watch</Link>
      </div>
    )
  }

  const item = getPriceWatchItem(purchase)
  const returnDaysLeft = daysUntil(purchase.returnDeadline)
  const priceMax = Math.max(1, purchase.price, ...item.history.map((h) => h.price))
  // Only ever real: a Best Deal only shows up once there's an actual
  // verified comparison cheaper than what was paid — never estimated,
  // never invented.
  const bestDeal = item.comparisons
    .filter((c) => c.verified && c.price < purchase.price)
    .sort((a, b) => a.price - b.price)[0]

  return (
    <div className="screen">
      <button className="back-link" onClick={() => navigate(-1)}>
        <IconChevronLeft />
        Back
      </button>

      <ProductImage purchase={purchase} />

      <div className="detail-hero">
        <div className="detail-hero__title">{productLabel(purchase)}</div>
        <div className="detail-hero__price">{formatMoney(purchase.price)}</div>
        <span className={`price-watch-status price-watch-status--${item.status}`}>{STATUS_LABEL[item.status]}</span>
        <div className="detail-hero__sub">
          Purchased {formatDate(purchase.purchaseDate)} at {purchase.store}
        </div>
      </div>

      {bestDeal && (
        <div className="best-deal">
          <div className="best-deal__label">Best Deal</div>
          <div className="best-deal__price">{formatMoney(bestDeal.price)}</div>
          <div className="best-deal__store">{bestDeal.store}</div>
          <div className="best-deal__savings">
            You save {formatMoney(purchase.price - bestDeal.price)} vs. what you paid
          </div>
        </div>
      )}

      <section className="detail-card">
        <div className="detail-card__label">You Purchased This</div>
        <div className="detail-card__row">
          <span>Purchased for</span>
          <strong>{formatMoney(purchase.price)}</strong>
        </div>
        <div className="detail-card__row">
          <span>Store</span>
          <strong>{purchase.store}</strong>
        </div>
        <div className="detail-card__row">
          <span>Purchase date</span>
          <strong>{formatDate(purchase.purchaseDate)}</strong>
        </div>
      </section>

      <section className="detail-card">
        <div className="detail-card__label">Price</div>
        <div className="detail-card__row">
          <span>Current price</span>
          <strong className={item.status === 'dropped' ? 'text-accent' : ''}>
            {item.currentPrice != null ? formatMoney(item.currentPrice) : 'Not checked yet'}
          </strong>
        </div>
        <div className="detail-card__row">
          <span>Lowest found</span>
          <strong>{item.lowestFound != null ? formatMoney(item.lowestFound) : '—'}</strong>
        </div>
        <div className="detail-card__row">
          <span>Highest found</span>
          <strong>{item.highestFound != null ? formatMoney(item.highestFound) : '—'}</strong>
        </div>
        <div className="detail-card__row">
          <span>Potential savings</span>
          <strong className={item.potentialSavings > 0 ? 'text-accent' : ''}>
            {formatMoney(item.potentialSavings)}
          </strong>
        </div>
        {item.checkedAt && (
          <p className="field-hint field-hint--block" style={{ margin: '6px 0 0' }}>
            Last checked {formatDate(item.checkedAt)}.
          </p>
        )}
      </section>

      <section className="detail-card">
        <div className="detail-card__label">Price History</div>
        {item.history.length === 0 ? (
          <p className="field-hint field-hint--block" style={{ margin: 0 }}>
            No price history yet — this fills in once ProofBack starts checking.
          </p>
        ) : (
          <div className="month-chart">
            {item.history.map((h, i) => (
              <div className="month-chart__col" key={i}>
                <div className="month-chart__bar-track">
                  <div className="month-chart__bar" style={{ height: `${Math.max(4, (h.price / priceMax) * 100)}%` }} />
                </div>
                <div className="month-chart__label">{formatDate(h.date).replace(/, \d{4}$/, '')}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="detail-card">
        <div className="detail-card__label">Store Comparison</div>
        <div className="detail-card__row">
          <span>{purchase.store} (your price)</span>
          <strong>{formatMoney(purchase.price)}</strong>
        </div>
        {item.comparisons.length === 0 ? (
          <p className="field-hint field-hint--block" style={{ margin: '6px 0 0' }}>
            No comparison available yet — ProofBack hasn't been able to verify this product's price anywhere else.
          </p>
        ) : (
          item.comparisons.map((c, i) => (
            <div className="detail-card__row" key={i}>
              <span>
                {c.store}
                {!c.verified && ' (estimated)'}
              </span>
              <strong>{formatMoney(c.price)}</strong>
            </div>
          ))
        )}
      </section>

      {purchase.returnDeadline && (
        <section className="detail-card">
          <div className="detail-card__label">Return Deadline</div>
          <div className="detail-card__row">
            <span>Return by</span>
            <strong>{formatDate(purchase.returnDeadline)}</strong>
          </div>
          <div className="detail-card__row">
            <span>Days remaining</span>
            <strong className={returnDaysLeft <= 7 ? 'text-warning' : ''}>
              {returnDaysLeft > 0 ? `${returnDaysLeft} days` : 'Closed'}
            </strong>
          </div>
        </section>
      )}

      <Link to={`/purchases/${purchase.id}`} className="btn btn--secondary btn--block">
        View Full Purchase
      </Link>
    </div>
  )
}
