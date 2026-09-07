import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { usePurchases } from '../lib/PurchasesContext.jsx'
import { formatDate, formatMoney, productLabel } from '../lib/derive.js'
import { getMerchantPolicy } from '../data/merchantPolicies.js'
import { IconChevronLeft } from '../components/Icons.jsx'

// Composes everything ProofBack knows about a purchase into one shareable
// summary. There's no backend PDF service, so this produces a plain-text
// block (copy/share) plus the un-redactable parts (photos) shown alongside
// it — redaction here means "leave it out of the package," since there's no
// way to black out part of an already-taken photo.
export default function EvidencePackage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { purchases } = usePurchases()
  const purchase = purchases.find((p) => p.id === id)
  const [redactAddress, setRedactAddress] = useState(true)
  const [redactPayment, setRedactPayment] = useState(true)
  const [redactPhotos, setRedactPhotos] = useState(false)
  const [copyStatus, setCopyStatus] = useState(null)

  if (!purchase) {
    return (
      <div className="screen">
        <p className="empty-note">Purchase not found.</p>
      </div>
    )
  }

  const merchantPolicy = getMerchantPolicy(purchase.store)
  const receiptPhotos = redactPhotos
    ? []
    : purchase.receiptImageUrls?.length
      ? purchase.receiptImageUrls
      : purchase.receiptImageUrl
        ? [purchase.receiptImageUrl]
        : []
  const docs = redactPhotos ? [] : purchase.supportingDocs || []

  const lines = [
    `Evidence Package — ${productLabel(purchase)}`,
    '',
    `Product: ${productLabel(purchase)}`,
    `Store: ${purchase.store}`,
    !redactAddress && purchase.storeAddress ? `Store address: ${purchase.storeAddress}` : null,
    `Purchased: ${formatDate(purchase.purchaseDate)}`,
    `Price: ${formatMoney(purchase.price)}`,
    purchase.orderNumber ? `Order number: ${purchase.orderNumber}` : null,
    purchase.serialNumber ? `Serial number: ${purchase.serialNumber}` : null,
    purchase.trackingNumber ? `Tracking number: ${purchase.trackingNumber}` : null,
    !redactPayment && purchase.paymentMethod ? `Payment method: ${purchase.paymentMethod}` : null,
    purchase.returnDeadline ? `Return deadline: ${formatDate(purchase.returnDeadline)}` : null,
    purchase.warrantyExpires ? `Warranty expires: ${formatDate(purchase.warrantyExpires)}` : null,
    '',
    merchantPolicy ? `Merchant policy (typical, not confirmed): return window ${merchantPolicy.returnWindowDays ?? 'no stated limit'} days, refund via ${merchantPolicy.refundMethod}.` : null,
    '',
    receiptPhotos.length ? `Receipt: ${receiptPhotos.length} photo(s) included` : 'Receipt: not included',
    docs.length ? `Supporting documents: ${docs.length} file(s) included` : null,
    '',
    purchase.recoveryCase?.submissionHistory?.length ? 'Activity timeline:' : null,
    ...(purchase.recoveryCase?.submissionHistory || []).map((e) => `  ${formatDate(e.date)} — ${e.note}`),
  ].filter((l) => l !== null)

  const summary = lines.join('\n')

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(summary)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('unsupported')
    }
    setTimeout(() => setCopyStatus(null), 2500)
  }

  return (
    <div className="screen">
      <button className="back-link" onClick={() => navigate(-1)}>
        <IconChevronLeft />
        Back
      </button>

      <div className="page-header">
        <h1>Evidence Package</h1>
        <p className="page-header__sub">
          Everything for {productLabel(purchase)}, ready to share with a merchant, manufacturer, or your card issuer.
        </p>
      </div>

      <section className="detail-card">
        <div className="detail-card__label">Redact before sharing</div>
        <label className="toggle-row">
          <div className="toggle-row__text">
            <div className="toggle-row__label">Store address</div>
          </div>
          <input type="checkbox" checked={redactAddress} onChange={(e) => setRedactAddress(e.target.checked)} />
        </label>
        <label className="toggle-row">
          <div className="toggle-row__text">
            <div className="toggle-row__label">Payment details</div>
          </div>
          <input type="checkbox" checked={redactPayment} onChange={(e) => setRedactPayment(e.target.checked)} />
        </label>
        <label className="toggle-row">
          <div className="toggle-row__text">
            <div className="toggle-row__label">Receipt/document photos</div>
            <div className="toggle-row__detail">
              Photos can't be edited to hide loyalty info or unrelated items — leaving this on excludes them entirely.
            </div>
          </div>
          <input type="checkbox" checked={redactPhotos} onChange={(e) => setRedactPhotos(e.target.checked)} />
        </label>
      </section>

      <section className="detail-card">
        <div className="detail-card__label">Summary</div>
        <pre className="claim-summary">{summary}</pre>
        <button className="btn btn--primary btn--block" onClick={copySummary}>
          Copy Summary
        </button>
        {copyStatus === 'copied' && <p className="field-hint field-hint--good">Copied to clipboard</p>}
        {copyStatus === 'unsupported' && <p className="field-hint">Copying isn't supported on this device/browser</p>}
      </section>

      {(receiptPhotos.length > 0 || docs.length > 0) && (
        <section className="detail-card">
          <div className="detail-card__label">Included Photos</div>
          <div className="page-strip">
            {[...receiptPhotos, ...docs].map((url, i) => (
              <img key={i} src={url} alt={`Evidence ${i + 1}`} className="page-strip__photo" />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
