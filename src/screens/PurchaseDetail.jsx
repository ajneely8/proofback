import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { usePurchases } from '../lib/PurchasesContext.jsx'
import { daysUntil, formatDate, formatDateTime, formatMoney, priceDrop, todayISO } from '../lib/derive.js'
import { IconChevronLeft } from '../components/Icons.jsx'
import ProductImage from '../components/ProductImage.jsx'

export default function PurchaseDetail() {
  const { id } = useParams()
  const { purchases, updatePurchase } = usePurchases()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(null)

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
  const receiptPhotos = purchase.receiptImageUrls?.length
    ? purchase.receiptImageUrls
    : purchase.receiptImageUrl
      ? [purchase.receiptImageUrl]
      : []

  function startReturn() {
    updatePurchase(purchase.id, { returnStatus: 'started' })
  }

  function completeReturn() {
    updatePurchase(purchase.id, { returnStatus: 'completed', returnCompletedDate: todayISO() })
  }

  function claimPriceAdjustment() {
    updatePurchase(purchase.id, { priceAdjustment: { amount: drop, claimedDate: todayISO() } })
  }

  function markRefundReceived() {
    updatePurchase(purchase.id, { refund: { ...refund, status: 'received', receivedDate: todayISO() } })
  }

  function startEditing() {
    setDraft({
      store: purchase.store,
      brand: purchase.brand,
      product: purchase.product,
      quantity: purchase.quantity || 1,
      price: purchase.price,
      purchaseDate: purchase.purchaseDate,
    })
    setEditing(true)
  }

  function saveEdits() {
    updatePurchase(purchase.id, {
      store: draft.store,
      brand: draft.brand,
      product: draft.product,
      quantity: Number(draft.quantity) || 1,
      price: Number(draft.price),
      currentPrice: Number(draft.price),
      purchaseDate: draft.purchaseDate,
    })
    setEditing(false)
    setDraft(null)
  }

  if (editing) {
    return (
      <div className="screen">
        <button className="back-link" onClick={() => setEditing(false)}>
          <IconChevronLeft />
          Cancel
        </button>

        <div className="page-header">
          <h1>Edit Purchase</h1>
        </div>

        <section className="detail-card">
          <div className="field-row">
            <label>Item</label>
            <input
              type="text"
              value={draft.product}
              onChange={(e) => setDraft({ ...draft, product: e.target.value })}
            />
          </div>
          <div className="field-row">
            <label>Brand</label>
            <input
              type="text"
              value={draft.brand}
              onChange={(e) => setDraft({ ...draft, brand: e.target.value })}
            />
          </div>
          <div className="field-row">
            <label>Store</label>
            <input
              type="text"
              value={draft.store}
              onChange={(e) => setDraft({ ...draft, store: e.target.value })}
            />
          </div>
          <div className="field-row">
            <label>Quantity</label>
            <input
              type="number"
              min="1"
              step="1"
              value={draft.quantity}
              onChange={(e) => setDraft({ ...draft, quantity: e.target.value })}
            />
          </div>
          <div className="field-row">
            <label>Price</label>
            <input
              type="number"
              step="0.01"
              value={draft.price}
              onChange={(e) => setDraft({ ...draft, price: e.target.value })}
            />
          </div>
          <div className="field-row">
            <label>Purchased</label>
            <input
              type="date"
              value={draft.purchaseDate}
              onChange={(e) => setDraft({ ...draft, purchaseDate: e.target.value })}
            />
          </div>
        </section>

        <button
          className="btn btn--primary btn--block"
          disabled={!draft.product || draft.price === '' || isNaN(Number(draft.price))}
          onClick={saveEdits}
        >
          Save Changes
        </button>
      </div>
    )
  }

  return (
    <div className="screen">
      <button className="back-link" onClick={() => navigate(-1)}>
        <IconChevronLeft />
        Back
      </button>

      <ProductImage purchase={purchase} />

      <div className="detail-hero">
        <div className="detail-hero__title">
          {purchase.brand} {purchase.product}
          {purchase.quantity > 1 ? ` ×${purchase.quantity}` : ''}
        </div>
        <div className="detail-hero__price">{formatMoney(purchase.price)}</div>
        <div className="detail-hero__sub">
          Purchased {formatDateTime(purchase.purchaseDate, purchase.purchaseTime)} at {purchase.store}
        </div>
        {purchase.storeAddress && <div className="detail-hero__sub">{purchase.storeAddress}</div>}
        {purchase.receiptNumber && <div className="detail-hero__sub">Receipt #{purchase.receiptNumber}</div>}
        <button className="link-action link-action--inline" onClick={startEditing}>
          Edit Purchase
        </button>
      </div>

      {(purchase.subtotal != null ||
        purchase.tax != null ||
        purchase.tip != null ||
        purchase.discount != null ||
        purchase.total != null ||
        purchase.paymentMethod) && (
        <section className="detail-card">
          <div className="detail-card__label">Receipt Totals</div>
          {purchase.subtotal != null && (
            <div className="detail-card__row">
              <span>Subtotal</span>
              <strong>{formatMoney(purchase.subtotal)}</strong>
            </div>
          )}
          {purchase.discount != null && (
            <div className="detail-card__row">
              <span>Discount</span>
              <strong className="text-accent">-{formatMoney(purchase.discount)}</strong>
            </div>
          )}
          {purchase.tax != null && (
            <div className="detail-card__row">
              <span>Tax</span>
              <strong>{formatMoney(purchase.tax)}</strong>
            </div>
          )}
          {purchase.tip != null && (
            <div className="detail-card__row">
              <span>Tip</span>
              <strong>{formatMoney(purchase.tip)}</strong>
            </div>
          )}
          {purchase.total != null && (
            <div className="detail-card__row">
              <span>Total</span>
              <strong>{formatMoney(purchase.total)}</strong>
            </div>
          )}
          {purchase.paymentMethod && (
            <div className="detail-card__row">
              <span>Payment</span>
              <strong>{purchase.paymentMethod}</strong>
            </div>
          )}
        </section>
      )}

      {purchase.itemDiscount != null && (
        <section className="detail-card">
          <div className="detail-card__label">Item Discount</div>
          <div className="detail-card__row">
            <span>Discount applied to this item</span>
            <strong className="text-accent">-{formatMoney(purchase.itemDiscount)}</strong>
          </div>
        </section>
      )}

      {purchase.returnDeadline && (
        <section className="detail-card">
          <div className="detail-card__label">Return</div>
          <div className="detail-card__row">
            <span>Return deadline{purchase.returnDeadlineSource === 'receipt' ? ' (from receipt)' : ''}</span>
            <strong>{formatDate(purchase.returnDeadline)}</strong>
          </div>
          <div className="detail-card__row">
            <span>Days remaining</span>
            <strong className={daysLeft <= 7 ? 'text-warning' : ''}>
              {daysLeft >= 0 ? `${daysLeft} days` : 'Closed'}
            </strong>
          </div>
          {purchase.returnStatus === 'completed' ? (
            <p className="confirm-prompt confirm-prompt--top">
              Return completed {formatDate(purchase.returnCompletedDate)} · {formatMoney(purchase.price)} recovered
            </p>
          ) : purchase.returnStatus === 'started' ? (
            <button className="btn btn--primary btn--block" onClick={completeReturn}>
              Mark Return Complete
            </button>
          ) : (
            daysLeft >= 0 && (
              <button className="btn btn--primary btn--block" onClick={startReturn}>
                Start Return
              </button>
            )
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
        {purchase.priceAdjustment ? (
          <p className="confirm-prompt confirm-prompt--top">
            {formatMoney(purchase.priceAdjustment.amount)} applied {formatDate(purchase.priceAdjustment.claimedDate)}
          </p>
        ) : (
          <button className="btn btn--secondary btn--block" disabled={drop <= 0} onClick={claimPriceAdjustment}>
            {drop > 0 ? 'Check Price Adjustment' : 'No Price Drop Found'}
          </button>
        )}
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
            {refund.status === 'received'
              ? 'Received'
              : refund.status === 'expected_missing'
                ? 'Not received'
                : 'Not applicable'}
          </strong>
        </div>
        {refund.status === 'expected_missing' && (
          <>
            <div className="detail-card__row">
              <span>Expected</span>
              <strong>{formatDate(refund.expectedDate)}</strong>
            </div>
            <button className="btn btn--secondary btn--block" onClick={markRefundReceived}>
              Mark Refund Received
            </button>
          </>
        )}
        {refund.status === 'received' && (
          <div className="detail-card__row">
            <span>Received</span>
            <strong>{formatDate(refund.receivedDate)}</strong>
          </div>
        )}
      </section>

      {receiptPhotos.length > 0 && (
        <section className="detail-card">
          <div className="detail-card__label">
            Receipt{receiptPhotos.length > 1 ? ` (${receiptPhotos.length} pages)` : ''}
          </div>
          {receiptPhotos.length > 1 ? (
            <div className="page-strip">
              {receiptPhotos.map((url, i) => (
                <img key={i} src={url} alt={`Receipt page ${i + 1}`} className="page-strip__photo" />
              ))}
            </div>
          ) : (
            <div className="receipt-photo">
              <img src={receiptPhotos[0]} alt="Scanned receipt" />
            </div>
          )}
        </section>
      )}
    </div>
  )
}
