import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { loadInboxItems, addInboxItem } from '../lib/receiptInbox.js'
import { formatDateTime } from '../lib/derive.js'
import { IconChevronLeft, IconUpload, IconMail } from '../components/Icons.jsx'
import EmptyState from '../components/EmptyState.jsx'

const STATUS_LABEL = { processed: 'Processed', needs_review: 'Needs review', processing: 'Processing' }

// Real inbound email (a unique per-user forwarding address) needs a domain
// and an email-receiving provider configured outside this codebase — none
// exists yet, so this screen says so plainly rather than showing a fake
// address. Uploading here runs through the exact same scan pipeline as
// "Upload from Photos" on Add Purchase (see AddPurchase.jsx's inboxFile
// handoff) — this screen is a history log of those uploads, not a second
// processing pipeline.
export default function ReceiptInbox() {
  const navigate = useNavigate()
  const [items, setItems] = useState(loadInboxItems)
  const fileInputRef = useRef(null)

  const processed = items.filter((i) => i.status === 'processed').length
  const needsReview = items.filter((i) => i.status === 'needs_review').length
  const processing = items.filter((i) => i.status === 'processing').length

  function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const id = `inbox-${Date.now()}`
    addInboxItem({ id, fileName: file.name || 'Receipt' })
    navigate('/add', { state: { inboxFile: file, inboxEntryId: id } })
  }

  return (
    <div className="screen">
      <button className="back-link" onClick={() => navigate(-1)}>
        <IconChevronLeft />
        Back
      </button>

      <div className="page-header">
        <h1>Receipt Inbox</h1>
        <p className="page-header__sub">
          Email forwarding isn't set up yet — upload receipts here for now. Forwarding a unique ProofBack address is
          coming soon.
        </p>
      </div>

      <div className="inbox-counts">
        <div className="inbox-counts__item">✓ {processed} processed</div>
        <div className="inbox-counts__item">⏳ {processing} processing</div>
        <div className="inbox-counts__item">⚠ {needsReview} needs review</div>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleFile} />
      <button className="btn btn--primary btn--block" onClick={() => fileInputRef.current?.click()}>
        <IconUpload width={18} height={18} />
        Upload a Receipt
      </button>

      {items.length === 0 ? (
        <EmptyState icon={IconMail} title="Nothing in your inbox yet" detail="Upload a receipt to see it processed here." />
      ) : (
        <div className="list" style={{ marginTop: 16 }}>
          {items.map((item) => (
            <div className="list-row list-row--simple" key={item.id}>
              <div className="list-row__main">
                <div className="list-row__title">{item.fileName}</div>
                <div className="list-row__line">{formatDateTime(item.createdAt?.slice(0, 10), null)}</div>
              </div>
              <div className="list-row__trailing">
                <div className={`inbox-status inbox-status--${item.status}`}>{STATUS_LABEL[item.status]}</div>
                {item.purchaseId && (
                  <Link to={`/purchases/${item.purchaseId}`} className="list-row__line">
                    View
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
