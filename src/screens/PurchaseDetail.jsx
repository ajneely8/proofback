import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { usePurchases } from '../lib/PurchasesContext.jsx'
import { daysUntil, formatDate, formatDateTime, formatMoney, priceDrop } from '../lib/derive.js'
import { IconChevronLeft } from '../components/Icons.jsx'
import ProductImage from '../components/ProductImage.jsx'

export default function PurchaseDetail() {
  const { id } = useParams()
  const { purchases } = usePurchases()
  const navigate = useNavigate()
  const [returnStarted, setReturnStarted] = useState(false)
  const [priceChecked, setPriceChecked] = useState(false)

  const purchase = purchases.find((p) => p.id === id)

  if (!purchase) {
    return (
      <div className="screen">
        <p className="empty-note">Purchase not found.</p>
        <Link to="/purchases" className="btn btn--secondary">Back to Purchases</Link>
      </div>
    )
  }

  const daysLeft = daysUntil(purchase.returnDeadline)
  const drop = priceDrop(purchase)
  const refund = purchase.refund

  return (
    <div className="screen">
      <button className="back-link" onClick={() => navigate(-1)}>
        <IconChevronLeft />
        Back
      </button>

      <ProductImage purchase={purchase} />

      <div className="detail-hero">
        <div className="detail-hero__title">{purchase.brand} {purchase.product}</div>
        <div className="detail-hero__price">{formatMoney(purchase.price)}</div>
        <div className="detail-hero__sub">
          Purchased {formatDateTime(purchase.purchaseDate, purchase.purchaseTime)}
        </div>
      </div>

      {purchase.returnDeadline && (
        <section className="detail-card">
          <div className="detail-card__label">Return</div>
          <div className="detail-card__row">
            <span>Return deadline</span>
            <strong>{formatDate(purchase.returnDeadline)}</strong>
          </div>
          <div className="detail-card__row">
            <span>Days remaining</span>
            <strong className={daysLeft <= 7 ? 'text-warning' : ''}>
              {daysLeft >= 0 ? `${daysLeft} days` : 'Closed'}
            </strong>
          </div>
          {daysLeft >= 0 && (
            <button
              className="btn btn--primary btn--block"
              disabled={returnStarted}
              onClick={() => setReturnStarted(true)}
            >
              {returnStarted ? 'Return Started' : 'Start Return'}
            </button>
          )}
        </section>
      )}

      <section className="detail-card">
        <div className="detail-card__label">Price Check</div>
        <div className="detail-card__row">
          <span>Current price</span>
          <strong className="text-accent">{formatMoney(purchase.currentPrice)}</strong>
        </div>
        <div className="detail-card__row">
          <span>Potential savings</span>
          <strong className="text-accent">{formatMoney(drop)}</strong>
        </div>
        <button
          className="btn btn--secondary btn--block"
          disabled={priceChecked}
          onClick={() => setPriceChecked(true)}
        >
          {priceChecked ? 'Price Checked' : 'Check Price Adjustment'}
        </button>
      </section>

      {purchase.warrantyExpires && (
        <section className="detail-card">
          <div className="detail-card__label">Warranty</div>
          <div className="detail-card__row">
            <span>Warranty expires</span>
            <strong>{formatDate(purchase.warrantyExpires)}</strong>
          </div>
        </section>
      )}

      <section className="detail-card">
        <div className="detail-card__label">Refund</div>
        <div className="detail-card__row">
          <span>Refund status</span>
          <strong>
            {refund.status === 'expected_missing' ? 'Not received' : 'Not applicable'}
          </strong>
        </div>
        {refund.status === 'expected_missing' && (
          <div className="detail-card__row">
            <span>Expected</span>
            <strong>{formatDate(refund.expectedDate)}</strong>
          </div>
        )}
      </section>
    </div>
  )
}
