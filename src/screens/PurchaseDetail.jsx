import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { usePurchases } from '../lib/PurchasesContext.jsx'
import { useSettings } from '../lib/SettingsContext.jsx'
import { daysUntil, formatDate, formatDateTime, formatMoney, priceDrop, productLabel, getPurchaseStatuses, getProtectionScore, todayISO } from '../lib/derive.js'
import { IconChevronLeft } from '../components/Icons.jsx'
import ProductImage from '../components/ProductImage.jsx'
import ReceiptViewer from '../components/ReceiptViewer.jsx'
import { sharePurchase } from '../lib/share.js'

export default function PurchaseDetail() {
  const { id } = useParams()
  const { purchases, updatePurchase, deletePurchase } = usePurchases()
  const { settings } = useSettings()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(null)
  const [viewerIndex, setViewerIndex] = useState(null) // receipt page index currently being viewed closely
  const [shareStatus, setShareStatus] = useState(null) // brief confirmation after a share/copy action
  const [priceCheckInput, setPriceCheckInput] = useState('')
  const [priceCheckOpen, setPriceCheckOpen] = useState(false)
  const [returnFormOpen, setReturnFormOpen] = useState(false)
  const [returnForm, setReturnForm] = useState({ refundAmount: '', returnMethod: '', notes: '' })
  const [claimOpen, setClaimOpen] = useState(false)
  const [claimProblem, setClaimProblem] = useState('')
  const [claimSummary, setClaimSummary] = useState(null)
  const [claimCopyStatus, setClaimCopyStatus] = useState(null)

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
  const statuses = getPurchaseStatuses(purchase, settings)
  const protection = getProtectionScore(purchase)
  const refund = purchase.refund
  const receiptPhotos = purchase.receiptImageUrls?.length
    ? purchase.receiptImageUrls
    : purchase.receiptImageUrl
      ? [purchase.receiptImageUrl]
      : []

  function startReturn() {
    updatePurchase(purchase.id, { returnStatus: 'started' })
  }

  function openReturnForm() {
    setReturnForm({ refundAmount: String(purchase.price), returnMethod: '', notes: '' })
    setReturnFormOpen(true)
  }

  function completeReturn() {
    updatePurchase(purchase.id, {
      returnStatus: 'completed',
      returnCompletedDate: todayISO(),
      returnRecord: {
        returnDate: todayISO(),
        refundAmount: returnForm.refundAmount === '' ? purchase.price : Number(returnForm.refundAmount),
        returnMethod: returnForm.returnMethod || null,
        notes: returnForm.notes || null,
      },
    })
    setReturnFormOpen(false)
  }

  function generateClaimSummary() {
    const lines = [
      `Warranty claim — ${productLabel(purchase)}`,
      '',
      `Product: ${productLabel(purchase)}`,
      `Purchased: ${formatDate(purchase.purchaseDate)}`,
      `Store: ${purchase.store}`,
      `Price: ${formatMoney(purchase.price)}`,
      `Receipt: ${receiptPhotos.length ? 'Saved in ProofBack' : 'Not on file'}`,
      purchase.serialNumber ? `Serial number: ${purchase.serialNumber}` : null,
      purchase.warrantyExpires ? `Warranty expires: ${formatDate(purchase.warrantyExpires)}` : null,
      '',
      'Problem description:',
      claimProblem || '(not described)',
    ].filter((l) => l !== null)
    const summary = lines.join('\n')
    setClaimSummary(summary)
    updatePurchase(purchase.id, { warrantyClaimDraft: { problemDescription: claimProblem, createdAt: todayISO() } })
  }

  async function copyClaimSummary() {
    try {
      await navigator.clipboard.writeText(claimSummary)
      setClaimCopyStatus('copied')
    } catch {
      setClaimCopyStatus('unsupported')
    }
    setTimeout(() => setClaimCopyStatus(null), 2500)
  }

  function claimPriceAdjustment() {
    updatePurchase(purchase.id, { priceAdjustment: { amount: drop, claimedDate: todayISO() } })
  }

  function logCurrentPrice() {
    const value = Number(priceCheckInput)
    if (!priceCheckInput || isNaN(value) || value < 0) return
    updatePurchase(purchase.id, { currentPrice: value, currentPriceCheckedDate: todayISO() })
    setPriceCheckInput('')
    setPriceCheckOpen(false)
  }

  function markRefundReceived() {
    updatePurchase(purchase.id, { refund: { ...refund, status: 'received', receivedDate: todayISO() } })
  }

  async function handleShare() {
    const result = await sharePurchase(purchase)
    if (result === 'cancelled') return
    setShareStatus(result)
    setTimeout(() => setShareStatus(null), 2500)
  }

  function handleDelete() {
    if (!window.confirm(`Delete "${productLabel(purchase)}"? This can't be undone.`)) return
    deletePurchase(purchase.id)
    navigate('/purchases')
  }

  function startEditing() {
    setDraft({
      store: purchase.store,
      brand: purchase.brand,
      product: purchase.product,
      color: purchase.color || '',
      size: purchase.size || '',
      gender: purchase.gender || '',
      sku: purchase.sku || '',
      quantity: purchase.quantity || 1,
      price: purchase.price,
      purchaseDate: purchase.purchaseDate,
      serialNumber: purchase.serialNumber || '',
      orderNumber: purchase.orderNumber || '',
      warrantyExpires: purchase.warrantyExpires || '',
      returnDeadline: purchase.returnDeadline || '',
      notes: purchase.notes || '',
    })
    setEditing(true)
  }

  function saveEdits() {
    updatePurchase(purchase.id, {
      store: draft.store,
      brand: draft.brand,
      product: draft.product,
      color: draft.color || null,
      size: draft.size || null,
      gender: draft.gender || null,
      sku: draft.sku || null,
      quantity: Number(draft.quantity) || 1,
      price: Number(draft.price),
      currentPrice: Number(draft.price),
      purchaseDate: draft.purchaseDate,
      serialNumber: draft.serialNumber || null,
      orderNumber: draft.orderNumber || null,
      warrantyExpires: draft.warrantyExpires || null,
      returnDeadline: draft.returnDeadline || null,
      notes: draft.notes || null,
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
            <label>Color</label>
            <input
              type="text"
              value={draft.color}
              onChange={(e) => setDraft({ ...draft, color: e.target.value })}
            />
          </div>
          <div className="field-row">
            <label>Size</label>
            <input
              type="text"
              value={draft.size}
              onChange={(e) => setDraft({ ...draft, size: e.target.value })}
            />
          </div>
          <div className="field-row">
            <label>Gender</label>
            <select value={draft.gender} onChange={(e) => setDraft({ ...draft, gender: e.target.value })}>
              <option value="">—</option>
              <option value="Men's">Men's</option>
              <option value="Women's">Women's</option>
              <option value="Boys'">Boys'</option>
              <option value="Girls'">Girls'</option>
              <option value="Unisex">Unisex</option>
            </select>
          </div>
          <div className="field-row">
            <label>SKU</label>
            <input
              type="text"
              value={draft.sku}
              onChange={(e) => setDraft({ ...draft, sku: e.target.value })}
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
            <div className="field-row__money">
              <span>$</span>
              <input
                type="number"
                step="0.01"
                value={draft.price}
                onChange={(e) => setDraft({ ...draft, price: e.target.value })}
              />
            </div>
          </div>
          <div className="field-row">
            <label>Purchased</label>
            <input
              type="date"
              value={draft.purchaseDate}
              onChange={(e) => setDraft({ ...draft, purchaseDate: e.target.value })}
            />
          </div>
          <div className="field-row">
            <label>Return deadline</label>
            <input
              type="date"
              value={draft.returnDeadline}
              onChange={(e) => setDraft({ ...draft, returnDeadline: e.target.value })}
            />
          </div>
          <div className="field-row">
            <label>Warranty expires</label>
            <input
              type="date"
              value={draft.warrantyExpires}
              onChange={(e) => setDraft({ ...draft, warrantyExpires: e.target.value })}
            />
          </div>
          <div className="field-row">
            <label>Serial number</label>
            <input
              type="text"
              value={draft.serialNumber}
              onChange={(e) => setDraft({ ...draft, serialNumber: e.target.value })}
            />
          </div>
          <div className="field-row">
            <label>Order number</label>
            <input
              type="text"
              value={draft.orderNumber}
              onChange={(e) => setDraft({ ...draft, orderNumber: e.target.value })}
            />
          </div>
          <div className="field-row field-row--stacked">
            <label>Notes</label>
            <textarea
              rows={3}
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
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
        <div className="detail-hero__title">{productLabel(purchase)}</div>
        <div className="detail-hero__price">{formatMoney(purchase.price)}</div>
        {statuses.length > 0 && (
          <div className="status-chips">
            {statuses.map((s) => (
              <span key={s.key} className={`status-chip status-chip--${s.tone}`}>
                {s.label}
              </span>
            ))}
          </div>
        )}
        <div className="protection-score">
          <div className="protection-score__track">
            <div className="protection-score__fill" style={{ width: `${protection.percent}%` }} />
          </div>
          <span className="protection-score__label">{protection.percent}% protected</span>
        </div>
        {purchase.color && <div className="detail-hero__sub">{purchase.color}</div>}
        <div className="detail-hero__sub">
          Purchased {formatDateTime(purchase.purchaseDate, purchase.purchaseTime)} at {purchase.store}
        </div>
        {purchase.storeAddress && <div className="detail-hero__sub">{purchase.storeAddress}</div>}
        {purchase.receiptNumber && <div className="detail-hero__sub">Receipt #{purchase.receiptNumber}</div>}
        <div className="detail-hero__actions">
          <button className="link-action link-action--inline" onClick={startEditing}>
            Edit Purchase
          </button>
          <button className="link-action link-action--inline" onClick={handleShare}>
            Share Purchase
          </button>
          <button className="link-action link-action--inline link-action--danger" onClick={handleDelete}>
            Delete
          </button>
        </div>
        {shareStatus === 'copied' && <p className="field-hint field-hint--good">Details copied to clipboard</p>}
        {shareStatus === 'shared' && <p className="field-hint field-hint--good">Shared</p>}
        {shareStatus === 'unsupported' && (
          <p className="field-hint">Sharing isn't supported on this device/browser</p>
        )}
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
              <strong className="text-accent">{formatMoney(purchase.subtotal)}</strong>
            </div>
          )}
          {purchase.discount != null && (
            <div className="detail-card__row">
              <span>Discount</span>
              <strong className="text-warning">-{formatMoney(purchase.discount)}</strong>
            </div>
          )}
          {purchase.tax != null && (
            <div className="detail-card__row">
              <span>Tax</span>
              <strong className="text-accent">+{formatMoney(purchase.tax)}</strong>
            </div>
          )}
          {purchase.tip != null && (
            <div className="detail-card__row">
              <span>Tip</span>
              <strong className="text-accent">+{formatMoney(purchase.tip)}</strong>
            </div>
          )}
          {purchase.total != null && (
            <div className="detail-card__row">
              <span>Total</span>
              <strong className="text-accent">{formatMoney(purchase.total)}</strong>
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

      <section className="detail-card">
        <div className="detail-card__label">Protection Score</div>
        <div className="detail-card__row">
          <span>{protection.percent}% protected</span>
        </div>
        <ul className="protection-checklist">
          {protection.checks.map((c) => (
            <li key={c.key} className={c.met ? 'is-met' : 'is-missing'}>
              {c.label} {c.met ? '✓' : '— missing'}
            </li>
          ))}
        </ul>
        {protection.percent < 100 && (
          <p className="field-hint" style={{ margin: '8px 0 0' }}>
            Add the missing details above (edit this purchase) to raise your score.
          </p>
        )}
      </section>

      {(purchase.sku || purchase.barcode || purchase.serialNumber || purchase.orderNumber) && (
        <section className="detail-card">
          <div className="detail-card__label">Item Code</div>
          {purchase.sku && (
            <div className="detail-card__row">
              <span>SKU</span>
              <strong>{purchase.sku}</strong>
            </div>
          )}
          {purchase.barcode && (
            <div className="detail-card__row">
              <span>Barcode</span>
              <strong>{purchase.barcode}</strong>
            </div>
          )}
          {purchase.serialNumber && (
            <div className="detail-card__row">
              <span>Serial number</span>
              <strong>{purchase.serialNumber}</strong>
            </div>
          )}
          {purchase.orderNumber && (
            <div className="detail-card__row">
              <span>Order number</span>
              <strong>{purchase.orderNumber}</strong>
            </div>
          )}
        </section>
      )}

      {purchase.notes && (
        <section className="detail-card">
          <div className="detail-card__label">Notes</div>
          <p className="field-hint" style={{ color: 'var(--text-secondary)', margin: 0 }}>{purchase.notes}</p>
        </section>
      )}

      {purchase.itemDiscount != null && (
        <section className="detail-card">
          <div className="detail-card__label">Item Discount</div>
          <div className="detail-card__row">
            <span>Discount applied to this item</span>
            <strong className="text-warning">-{formatMoney(purchase.itemDiscount)}</strong>
          </div>
        </section>
      )}

      {purchase.returnDeadline && (
        <section className="detail-card">
          <div className="detail-card__label">Return</div>
          <div className="detail-card__row">
            <span>
              Return deadline
              {purchase.returnDeadlineSource === 'receipt' && ' (from receipt)'}
              {purchase.returnDeadlineSource === 'store_policy' && ` (${purchase.store}'s typical policy)`}
              {purchase.returnDeadlineSource === 'estimated' && ' (estimated — confirm with store)'}
            </span>
            <strong>{formatDate(purchase.returnDeadline)}</strong>
          </div>
          <div className="detail-card__row">
            <span>Days remaining</span>
            <strong className={daysLeft <= settings.urgentWindowDays ? 'text-warning' : ''}>
              {daysLeft >= 0 ? `${daysLeft} days` : 'Closed'}
            </strong>
          </div>
          {purchase.returnStatus === 'completed' ? (
            <p className="confirm-prompt confirm-prompt--top">
              Returned {formatDate(purchase.returnRecord?.returnDate || purchase.returnCompletedDate)} ·{' '}
              {formatMoney(purchase.returnRecord?.refundAmount ?? purchase.price)} recovered
              {purchase.returnRecord?.returnMethod ? ` via ${purchase.returnRecord.returnMethod}` : ''}
            </p>
          ) : returnFormOpen ? (
            <>
              <div className="field-row">
                <label>Refund amount</label>
                <div className="field-row__money">
                  <span>$</span>
                  <input
                    type="number"
                    step="0.01"
                    autoFocus
                    value={returnForm.refundAmount}
                    onChange={(e) => setReturnForm({ ...returnForm, refundAmount: e.target.value })}
                  />
                </div>
              </div>
              <div className="field-row">
                <label>Return method</label>
                <input
                  type="text"
                  placeholder="e.g. In-store, mail"
                  value={returnForm.returnMethod}
                  onChange={(e) => setReturnForm({ ...returnForm, returnMethod: e.target.value })}
                />
              </div>
              <div className="field-row field-row--stacked">
                <label>Notes</label>
                <textarea
                  rows={2}
                  value={returnForm.notes}
                  onChange={(e) => setReturnForm({ ...returnForm, notes: e.target.value })}
                />
              </div>
              <div className="action-row">
                <button className="btn btn--secondary" onClick={() => setReturnFormOpen(false)}>
                  Cancel
                </button>
                <button className="btn btn--primary" onClick={completeReturn}>
                  Confirm Returned
                </button>
              </div>
            </>
          ) : purchase.returnStatus === 'started' ? (
            <button className="btn btn--primary btn--block" onClick={openReturnForm}>
              Mark Return Complete
            </button>
          ) : (
            daysLeft >= 0 && (
              <>
                <button className="btn btn--primary btn--block" onClick={startReturn}>
                  Start Return
                </button>
                <button className="btn btn--secondary btn--block" onClick={openReturnForm}>
                  Returned
                </button>
              </>
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
        {purchase.currentPriceCheckedDate && (
          <div className="detail-card__row">
            <span>Last checked</span>
            <strong>{formatDate(purchase.currentPriceCheckedDate)}</strong>
          </div>
        )}
        <div className="detail-card__row">
          <span>Potential savings</span>
          <strong className="text-accent">{formatMoney(drop)}</strong>
        </div>

        {priceCheckOpen ? (
          <>
            <div className="field-row">
              <label>Price you saw</label>
              <div className="field-row__money">
                <span>$</span>
                <input
                  type="number"
                  step="0.01"
                  autoFocus
                  value={priceCheckInput}
                  onChange={(e) => setPriceCheckInput(e.target.value)}
                />
              </div>
            </div>
            <div className="action-row">
              <button className="btn btn--secondary" onClick={() => setPriceCheckOpen(false)}>
                Cancel
              </button>
              <button className="btn btn--primary" onClick={logCurrentPrice}>
                Save
              </button>
            </div>
          </>
        ) : (
          <button className="btn btn--secondary btn--block" onClick={() => setPriceCheckOpen(true)}>
            Log a Price You Saw
          </button>
        )}

        {purchase.priceAdjustment ? (
          <p className="confirm-prompt confirm-prompt--top">
            {formatMoney(purchase.priceAdjustment.amount)} applied {formatDate(purchase.priceAdjustment.claimedDate)}
          </p>
        ) : (
          <button
            className="btn btn--secondary btn--block"
            disabled={drop <= 0}
            onClick={claimPriceAdjustment}
            style={{ marginTop: 8 }}
          >
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

          {claimOpen ? (
            <>
              <div className="field-row field-row--stacked">
                <label>Describe the problem</label>
                <textarea
                  rows={3}
                  autoFocus
                  value={claimProblem}
                  onChange={(e) => setClaimProblem(e.target.value)}
                  placeholder="What's wrong with the product?"
                />
              </div>
              {!claimSummary ? (
                <div className="action-row">
                  <button className="btn btn--secondary" onClick={() => setClaimOpen(false)}>
                    Cancel
                  </button>
                  <button className="btn btn--primary" onClick={generateClaimSummary} disabled={!claimProblem.trim()}>
                    Generate Claim Summary
                  </button>
                </div>
              ) : (
                <>
                  <p className="field-hint" style={{ color: 'var(--text-secondary)' }}>
                    ProofBack doesn't submit claims on your behalf — copy this summary and send it to the
                    manufacturer or retailer yourself.
                  </p>
                  <pre className="claim-summary">{claimSummary}</pre>
                  <div className="action-row">
                    <button
                      className="btn btn--secondary"
                      onClick={() => {
                        setClaimOpen(false)
                        setClaimSummary(null)
                      }}
                    >
                      Close
                    </button>
                    <button className="btn btn--primary" onClick={copyClaimSummary}>
                      Copy Summary
                    </button>
                  </div>
                  {claimCopyStatus === 'copied' && (
                    <p className="field-hint field-hint--good">Copied to clipboard</p>
                  )}
                  {claimCopyStatus === 'unsupported' && (
                    <p className="field-hint">Copying isn't supported on this device/browser</p>
                  )}
                </>
              )}
            </>
          ) : (
            <button className="btn btn--secondary btn--block" onClick={() => setClaimOpen(true)}>
              Start Warranty Claim
            </button>
          )}
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
                <button
                  key={i}
                  className="page-strip__photo-btn"
                  onClick={() => setViewerIndex(i)}
                  aria-label={`View receipt page ${i + 1} closely`}
                >
                  <img src={url} alt={`Receipt page ${i + 1}`} className="page-strip__photo" />
                </button>
              ))}
            </div>
          ) : (
            <button
              className="receipt-photo-btn receipt-photo"
              onClick={() => setViewerIndex(0)}
              aria-label="View receipt closely"
            >
              <img src={receiptPhotos[0]} alt="Scanned receipt" />
            </button>
          )}
        </section>
      )}

      {viewerIndex !== null && (
        <ReceiptViewer images={receiptPhotos} startIndex={viewerIndex} onClose={() => setViewerIndex(null)} />
      )}
    </div>
  )
}
