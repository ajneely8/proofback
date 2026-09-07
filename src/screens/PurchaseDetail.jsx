import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { usePurchases } from '../lib/PurchasesContext.jsx'
import { useSettings } from '../lib/SettingsContext.jsx'
import {
  daysUntil,
  formatDate,
  formatDateTime,
  formatMoney,
  productLabel,
  getPurchaseStatuses,
  getProofReadiness,
  refundOverdue,
  getDuplicatePurchaseFlags,
  todayISO,
} from '../lib/derive.js'
import { getMerchantPolicy } from '../data/merchantPolicies.js'
import { IconChevronLeft } from '../components/Icons.jsx'
import ProductImage from '../components/ProductImage.jsx'
import ReceiptViewer from '../components/ReceiptViewer.jsx'
import { sharePurchase } from '../lib/share.js'

const CLAIM_TYPE_LABELS = { return: 'Return', warranty: 'Warranty', chargeback: 'Chargeback', insurance: 'Insurance claim' }

function compressPhoto(file, maxWidth = 900, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width)
        const canvas = document.createElement('canvas')
        canvas.width = img.width * scale
        canvas.height = img.height * scale
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = reject
      img.src = reader.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function PurchaseDetail() {
  const { id } = useParams()
  const { purchases, updatePurchase, deletePurchase } = usePurchases()
  const { settings } = useSettings()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(null)
  const [viewerIndex, setViewerIndex] = useState(null) // receipt page index currently being viewed closely
  const [shareStatus, setShareStatus] = useState(null) // brief confirmation after a share/copy action
  const [returnFormOpen, setReturnFormOpen] = useState(false)
  const [returnForm, setReturnForm] = useState({ refundAmount: '', returnMethod: '', notes: '' })
  const [claimOpen, setClaimOpen] = useState(false)
  const [claimProblem, setClaimProblem] = useState('')
  const [claimSummary, setClaimSummary] = useState(null)
  const [claimCopyStatus, setClaimCopyStatus] = useState(null)
  const [refundTrackOpen, setRefundTrackOpen] = useState(false)
  const [refundTrackForm, setRefundTrackForm] = useState({ expectedAmount: '', expectedDate: '' })
  const [readinessOpen, setReadinessOpen] = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [docUploading, setDocUploading] = useState(false)

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
  const statuses = getPurchaseStatuses(purchase, settings)
  const readiness = getProofReadiness(purchase)
  const protection = readiness.overall
  const refund = purchase.refund
  const merchantPolicy = getMerchantPolicy(purchase.store)
  const duplicateFlag = getDuplicatePurchaseFlags(purchases).find(
    (f) => f.purchases[0].id === purchase.id || f.purchases[1].id === purchase.id
  )
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

  function markRefundReceived() {
    updatePurchase(purchase.id, { refund: { ...refund, status: 'received', receivedDate: todayISO() } })
  }

  function openTrackRefund() {
    setRefundTrackForm({
      expectedAmount: String(refund?.expectedAmount ?? purchase.price ?? ''),
      expectedDate: refund?.expectedDate || '',
    })
    setRefundTrackOpen(true)
  }

  function saveTrackRefund() {
    updatePurchase(purchase.id, {
      refund: {
        ...refund,
        status: 'expected_missing',
        expectedAmount: refundTrackForm.expectedAmount === '' ? null : Number(refundTrackForm.expectedAmount),
        expectedDate: refundTrackForm.expectedDate || null,
      },
    })
    setRefundTrackOpen(false)
  }

  function dismissRecovery(resolution) {
    updatePurchase(purchase.id, {
      recoveryCase: {
        id: `${purchase.id}-case-closed`,
        type: 'return',
        status: 'closed',
        amount: 0,
        eligibilityReason: null,
        deadline: null,
        requiredEvidence: [],
        evidenceProvided: [],
        submissionHistory: [{ date: todayISO(), note: resolution === 'kept_item' ? 'Kept the item' : 'Marked not relevant' }],
        resolution,
      },
    })
  }

  function startDuplicateClaim() {
    if (!duplicateFlag) return
    updatePurchase(purchase.id, {
      recoveryCase: {
        id: duplicateFlag.id,
        type: 'duplicate_purchase',
        status: 'evidence_ready',
        amount: duplicateFlag.amount,
        eligibilityReason: `Possible duplicate charge at ${purchase.store}`,
        deadline: null,
        requiredEvidence: ['Both receipts'],
        evidenceProvided: receiptPhotos.length ? ['Both receipts'] : [],
        submissionHistory: [{ date: todayISO(), note: 'Flagged as a possible duplicate purchase' }],
        resolution: null,
      },
    })
  }

  function dismissDuplicate() {
    if (!duplicateFlag) return
    updatePurchase(purchase.id, {
      recoveryCase: {
        id: duplicateFlag.id,
        type: 'duplicate_purchase',
        status: 'closed',
        amount: 0,
        submissionHistory: [{ date: todayISO(), note: 'Not a duplicate — dismissed' }],
        resolution: 'not_relevant',
      },
    })
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoUploading(true)
    try {
      const dataUrl = await compressPhoto(file)
      updatePurchase(purchase.id, { productPhotoUrl: dataUrl })
    } finally {
      setPhotoUploading(false)
      e.target.value = ''
    }
  }

  async function handleDocUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setDocUploading(true)
    try {
      const dataUrl = await compressPhoto(file, 1100, 0.75)
      updatePurchase(purchase.id, { supportingDocs: [...(purchase.supportingDocs || []), dataUrl] })
    } finally {
      setDocUploading(false)
      e.target.value = ''
    }
  }

  function removeDoc(index) {
    updatePurchase(purchase.id, { supportingDocs: purchase.supportingDocs.filter((_, i) => i !== index) })
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
      trackingNumber: purchase.trackingNumber || '',
      warrantyExpires: purchase.warrantyExpires || '',
      returnDeadline: purchase.returnDeadline || '',
      notes: purchase.notes || '',
      isBusinessExpense: !!purchase.isBusinessExpense,
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
      purchaseDate: draft.purchaseDate,
      serialNumber: draft.serialNumber || null,
      orderNumber: draft.orderNumber || null,
      trackingNumber: draft.trackingNumber || null,
      warrantyExpires: draft.warrantyExpires || null,
      returnDeadline: draft.returnDeadline || null,
      notes: draft.notes || null,
      isBusinessExpense: draft.isBusinessExpense,
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
          <div className="field-row">
            <label>Tracking number</label>
            <input
              type="text"
              value={draft.trackingNumber}
              onChange={(e) => setDraft({ ...draft, trackingNumber: e.target.value })}
            />
          </div>
          <div className="field-row">
            <label>Business expense</label>
            <input
              type="checkbox"
              checked={draft.isBusinessExpense}
              onChange={(e) => setDraft({ ...draft, isBusinessExpense: e.target.checked })}
              style={{ width: 'auto' }}
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
        purchase.feeAmount != null ||
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
          {purchase.feeAmount != null && (
            <div className="detail-card__row">
              <span>{purchase.feeLabel || 'Fee'}</span>
              <strong className="text-accent">+{formatMoney(purchase.feeAmount)}</strong>
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
        <div className="detail-card__label">Proof Readiness</div>
        <div className="detail-card__row">
          <span>{protection.percent}% ready</span>
        </div>
        <ul className="protection-checklist">
          {protection.checks.map((c) => (
            <li key={c.key} className={c.met ? 'is-met' : 'is-missing'}>
              {c.label} {c.met ? '✓' : '— missing'}
            </li>
          ))}
        </ul>
        {protection.percent < 100 && (
          <p className="field-hint field-hint--block" style={{ margin: '8px 0 0' }}>
            Add the missing details above (edit this purchase) to raise your score.
          </p>
        )}
        <button className="link-action" onClick={() => setReadinessOpen((v) => !v)} style={{ marginTop: 8 }}>
          {readinessOpen ? 'Hide' : 'Show'} readiness by claim type
        </button>
        {readinessOpen && (
          <div className="readiness-by-type">
            {Object.entries(readiness.byType).map(([type, r]) => (
              <div key={type} className="readiness-by-type__row">
                <div className="readiness-by-type__head">
                  <span>{CLAIM_TYPE_LABELS[type]}</span>
                  <strong>{r.percent}%</strong>
                </div>
                <ul className="protection-checklist">
                  {r.checks.map((c) => (
                    <li key={c.key} className={c.met ? 'is-met' : 'is-missing'}>
                      {c.label} {c.met ? '✓' : '— missing'}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {(purchase.sku || purchase.barcode || purchase.serialNumber || purchase.orderNumber || purchase.trackingNumber) && (
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
          {purchase.trackingNumber && (
            <div className="detail-card__row">
              <span>Tracking number</span>
              <strong>{purchase.trackingNumber}</strong>
            </div>
          )}
        </section>
      )}

      {(purchase.notes || purchase.isBusinessExpense) && (
        <section className="detail-card">
          <div className="detail-card__label">Notes</div>
          {purchase.notes && (
            <p className="field-hint field-hint--block" style={{ color: 'var(--text-secondary)', margin: 0 }}>{purchase.notes}</p>
          )}
          {purchase.isBusinessExpense && (
            <div className="detail-card__row" style={{ marginTop: purchase.notes ? 10 : 0 }}>
              <span>Marked as a business expense</span>
            </div>
          )}
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
          ) : purchase.recoveryCase?.status === 'closed' ? (
            <p className="field-hint field-hint--block" style={{ margin: 0 }}>
              {purchase.recoveryCase.resolution === 'kept_item' ? 'Kept the item.' : 'Marked not relevant.'}
            </p>
          ) : (
            daysLeft >= 0 && (
              <>
                <button className="btn btn--primary btn--block" onClick={startReturn}>
                  Start Return
                </button>
                <button className="btn btn--secondary btn--block" onClick={openReturnForm}>
                  Returned
                </button>
                <div className="action-row" style={{ marginTop: 8 }}>
                  <button className="link-action link-action--inline" onClick={() => dismissRecovery('kept_item')}>
                    Keep Item
                  </button>
                  <button className="link-action link-action--inline" onClick={() => dismissRecovery('not_relevant')}>
                    Not Relevant
                  </button>
                </div>
              </>
            )
          )}
        </section>
      )}

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
                  <p className="field-hint field-hint--block" style={{ color: 'var(--text-secondary)' }}>
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
                ? refundOverdue(purchase) ? 'Overdue' : 'Not received'
                : 'Not applicable'}
          </strong>
        </div>
        {refund.status === 'expected_missing' && refund.expectedAmount != null && (
          <div className="detail-card__row">
            <span>Expected amount</span>
            <strong className="text-accent">{formatMoney(refund.expectedAmount)}</strong>
          </div>
        )}
        {refund.status === 'expected_missing' && refund.expectedDate && (
          <div className="detail-card__row">
            <span>Expected</span>
            <strong className={refundOverdue(purchase) ? 'text-warning' : ''}>{formatDate(refund.expectedDate)}</strong>
          </div>
        )}

        {refundTrackOpen ? (
          <>
            <div className="field-row">
              <label>Expected refund amount</label>
              <div className="field-row__money">
                <span>$</span>
                <input
                  type="number"
                  step="0.01"
                  autoFocus
                  value={refundTrackForm.expectedAmount}
                  onChange={(e) => setRefundTrackForm({ ...refundTrackForm, expectedAmount: e.target.value })}
                />
              </div>
            </div>
            <div className="field-row">
              <label>Expected date</label>
              <input
                type="date"
                value={refundTrackForm.expectedDate}
                onChange={(e) => setRefundTrackForm({ ...refundTrackForm, expectedDate: e.target.value })}
              />
            </div>
            <div className="action-row">
              <button className="btn btn--secondary" onClick={() => setRefundTrackOpen(false)}>
                Cancel
              </button>
              <button className="btn btn--primary" onClick={saveTrackRefund}>
                Save
              </button>
            </div>
          </>
        ) : refund.status === 'expected_missing' ? (
          <>
            <button className="btn btn--secondary btn--block" onClick={openTrackRefund}>
              {refund.expectedAmount != null ? 'Update Tracked Refund' : 'Track Refund'}
            </button>
            <button className="btn btn--primary btn--block" onClick={markRefundReceived} style={{ marginTop: 8 }}>
              Mark Resolved — Refund Received
            </button>
          </>
        ) : refund.status === 'received' ? (
          <div className="detail-card__row">
            <span>Received</span>
            <strong>{formatDate(refund.receivedDate)}</strong>
          </div>
        ) : (
          <button className="btn btn--secondary btn--block" onClick={openTrackRefund}>
            Track Refund
          </button>
        )}
      </section>

      {duplicateFlag && (
        <section className="detail-card">
          <div className="detail-card__label">Possible Duplicate Purchase</div>
          <p className="field-hint field-hint--block" style={{ color: 'var(--text-secondary)', margin: '0 0 10px' }}>
            {duplicateFlag.eligibilityReason ||
              `Another purchase at ${purchase.store} for ${formatMoney(duplicateFlag.amount)} was logged around the
              same time — this may be a duplicate scan or an actual duplicate charge worth checking.`}
          </p>
          {purchase.recoveryCase?.type === 'duplicate_purchase' ? (
            <p className="field-hint field-hint--block" style={{ margin: 0 }}>
              {purchase.recoveryCase.status === 'closed'
                ? 'Marked not relevant.'
                : `Claim started — status: ${purchase.recoveryCase.status.replace('_', ' ')}.`}
            </p>
          ) : (
            <div className="action-row">
              <button className="btn btn--secondary" onClick={dismissDuplicate}>
                Not Relevant
              </button>
              <button className="btn btn--primary" onClick={startDuplicateClaim}>
                Start Claim
              </button>
            </div>
          )}
        </section>
      )}

      {merchantPolicy && (
        <section className="detail-card">
          <div className="detail-card__label">Merchant Policy — {purchase.store}</div>
          <p className="field-hint field-hint--block" style={{ color: 'var(--text-secondary)', margin: '0 0 10px' }}>
            ProofBack's general understanding of this store's typical policy — not a confirmed live lookup; always
            verify with {purchase.store} directly.
          </p>
          <div className="detail-card__row">
            <span>Return window</span>
            <strong>{merchantPolicy.returnWindowDays ? `${merchantPolicy.returnWindowDays} days` : 'No stated limit'}</strong>
          </div>
          <div className="detail-card__row">
            <span>Receipt required</span>
            <strong>{merchantPolicy.receiptRequired ? 'Yes' : 'Not always'}</strong>
          </div>
          {merchantPolicy.restockingFeePercent > 0 && (
            <div className="detail-card__row">
              <span>Restocking fee</span>
              <strong>{merchantPolicy.restockingFeePercent}%</strong>
            </div>
          )}
          <div className="detail-card__row">
            <span>Refund method</span>
            <strong>{merchantPolicy.refundMethod}</strong>
          </div>
          {merchantPolicy.exclusions?.length > 0 && (
            <p className="field-hint field-hint--block" style={{ margin: '6px 0 0' }}>
              Exclusions: {merchantPolicy.exclusions.join('; ')}
            </p>
          )}
          {merchantPolicy.warrantyInstructions && (
            <p className="field-hint field-hint--block" style={{ margin: '6px 0 0', color: 'var(--text-secondary)' }}>
              Warranty: {merchantPolicy.warrantyInstructions}
            </p>
          )}
        </section>
      )}

      <section className="detail-card">
        <div className="detail-card__label">Product Photo</div>
        {purchase.productPhotoUrl ? (
          <img src={purchase.productPhotoUrl} alt={productLabel(purchase)} className="product-photo" />
        ) : (
          <p className="field-hint field-hint--block" style={{ color: 'var(--text-secondary)', margin: '0 0 10px' }}>
            No photo added yet — ProofBack can't look up a real product photo automatically, but you can add your own.
          </p>
        )}
        <label className="btn btn--secondary btn--block" style={{ marginTop: purchase.productPhotoUrl ? 10 : 0 }}>
          {photoUploading ? 'Uploading…' : purchase.productPhotoUrl ? 'Replace Photo' : 'Add Photo'}
          <input type="file" accept="image/*" onChange={handlePhotoUpload} hidden disabled={photoUploading} />
        </label>
      </section>

      <section className="detail-card">
        <div className="detail-card__label">Supporting Documents</div>
        <p className="field-hint field-hint--block" style={{ color: 'var(--text-secondary)', margin: '0 0 10px' }}>
          Anything beyond the original receipt — a repair estimate, an email, a shipping label.
        </p>
        {purchase.supportingDocs?.length > 0 && (
          <div className="page-strip">
            {purchase.supportingDocs.map((url, i) => (
              <div key={i} className="page-strip__photo-btn" style={{ position: 'relative' }}>
                <img src={url} alt={`Supporting document ${i + 1}`} className="page-strip__photo" />
                <button
                  className="doc-remove"
                  onClick={() => removeDoc(i)}
                  aria-label={`Remove document ${i + 1}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <label className="btn btn--secondary btn--block">
          {docUploading ? 'Uploading…' : 'Add Document'}
          <input type="file" accept="image/*" onChange={handleDocUpload} hidden disabled={docUploading} />
        </label>
      </section>

      {purchase.recoveryCase?.submissionHistory?.length > 0 && (
        <section className="detail-card">
          <div className="detail-card__label">Claim History</div>
          <ul className="claim-history">
            {purchase.recoveryCase.submissionHistory.map((entry, i) => (
              <li key={i}>
                <strong>{formatDate(entry.date)}</strong> — {entry.note}
              </li>
            ))}
          </ul>
        </section>
      )}

      <Link to={`/purchases/${purchase.id}/evidence`} className="btn btn--secondary btn--block" style={{ marginTop: 4 }}>
        Generate Evidence Package
      </Link>

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
