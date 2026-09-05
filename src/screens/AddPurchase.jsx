import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { usePurchases } from '../lib/PurchasesContext.jsx'
import { IconCamera, IconUpload, IconChevronLeft, IconCheck, IconBarcode } from '../components/Icons.jsx'
import ProductImage from '../components/ProductImage.jsx'
import BarcodeScanner, { isBarcodeScanSupported } from '../components/BarcodeScanner.jsx'
import ReceiptViewer from '../components/ReceiptViewer.jsx'
import { ReceiptScan } from '../components/OnboardingVisuals.jsx'

// Downscales and re-encodes a photo as a compressed JPEG data URL, rather
// than sending/storing it at full camera resolution — a phone photo can
// easily be several MB, which is both slow to upload and, in production,
// well over the ~4.5MB request body limit Vercel's serverless functions
// enforce on the scan API.
function compressImage(file, maxWidth, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width)
        const canvas = document.createElement('canvas')
        canvas.width = img.width * scale
        canvas.height = img.height * scale
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = reject
      img.src = reader.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// What actually gets read by the model — big enough to keep receipt text
// legible, small enough to stay well under the request size limit even
// with several pages attached.
function compressForScan(file) {
  return compressImage(file, 1500, 0.82)
}

// A smaller copy kept on the saved purchase so it stays viewable later,
// without ballooning localStorage.
function compressForStorage(file) {
  return compressImage(file, 700, 0.7)
}

function dataUrlToBase64(dataUrl) {
  return dataUrl.slice(dataUrl.indexOf(',') + 1)
}

// Flags a likely re-scan of a receipt already saved — same store and date,
// plus either a matching receipt number or a matching total (whichever both
// records have), rather than blocking the save outright, since it's only a
// guess and a real duplicate purchase (two separate trips, same store, same
// day) is possible.
function findDuplicateReceipt(extracted, purchases) {
  if (!extracted?.store || !extracted?.purchaseDate) return null
  const store = extracted.store.trim().toLowerCase()
  return (
    purchases.find((p) => {
      if (!p.store || p.store.trim().toLowerCase() !== store) return false
      if (p.purchaseDate !== extracted.purchaseDate) return false
      if (extracted.receiptNumber && p.receiptNumber) {
        return p.receiptNumber === extracted.receiptNumber
      }
      if (extracted.total != null && p.total != null) {
        return Math.abs(Number(p.total) - Number(extracted.total)) < 0.01
      }
      return false
    }) || null
  )
}

const FIELD_LABELS = {
  store: 'Store',
  purchaseDate: 'Purchase date',
  purchaseTime: 'Time',
  product: 'Item name',
  price: 'Price',
  warrantyExpires: 'Warranty',
}

const FIELD_HINTS = {
  store: 'Not found on receipt',
  purchaseDate: 'Not found on receipt — defaulted to today',
  purchaseTime: 'Not found on receipt',
  product: 'Not found on receipt',
  price: 'Not found on receipt',
  warrantyExpires: 'No warranty tracked for this category',
}

// Roughly matches the real order of work while a scan is in flight (one
// model call to read the receipt, then a per-item photo lookup afterward)
// so this is a description of what's actually happening, not just a
// generic spinner — even though it can't be synced to the exact moment
// each field lands, since the model returns everything in one response.
const SCAN_STEPS = [
  'Reading your receipt…',
  'Finding the store, date, and total…',
  'Pulling out every item…',
  'Looking up product photos…',
  'Finishing up…',
]

const ERROR_MESSAGES = {
  no_receipt_detected: "We couldn't read a receipt in those photos. Try again with better lighting.",
  server_missing_api_key: 'Receipt scanning is not set up yet. Add an Anthropic API key to the server.',
  missing_image: 'No photo was received. Try again.',
  too_many_images: "That's too many pages for one receipt — try up to 6 photos.",
  extraction_failed: "We couldn't read that receipt. Try again.",
  scan_failed: 'Something went wrong scanning that receipt. Try again.',
  network: "Couldn't reach the scan service. Check your connection and try again.",
  rate_limited: "You've hit the API rate limit. Wait a moment and try again.",
  model_overloaded: "Claude is overloaded right now. Wait a moment and try again — this isn't something on our end.",
  connection_error: "Couldn't connect to the scanning service right now. Wait a moment and try again.",
}

export default function AddPurchase() {
  const [stage, setStage] = useState('scan') // scan | capturing | scanning | review | error | saved
  const [photos, setPhotos] = useState([]) // [{ file, previewUrl }]
  const [extracted, setExtracted] = useState(null)
  const [errorKey, setErrorKey] = useState(null)
  const [scanStep, setScanStep] = useState(0)
  const [barcodeTarget, setBarcodeTarget] = useState(null) // item index currently being scanned
  const [viewerIndex, setViewerIndex] = useState(null) // receipt page index currently being viewed closely
  const [duplicateDismissed, setDuplicateDismissed] = useState(false)
  const { addPurchase, purchases } = usePurchases()
  const navigate = useNavigate()
  const cameraInputRef = useRef(null)
  const uploadInputRef = useRef(null)

  const duplicate = useMemo(
    () => (extracted ? findDuplicateReceipt(extracted, purchases) : null),
    [extracted, purchases]
  )

  useEffect(() => {
    if (stage !== 'scanning') return
    setScanStep(0)
    const id = setInterval(() => {
      setScanStep((i) => (i + 1) % SCAN_STEPS.length)
    }, 1600)
    return () => clearInterval(id)
  }, [stage])

  function addPhoto(file) {
    if (!file) return
    setPhotos((prev) => [...prev, { file, previewUrl: URL.createObjectURL(file) }])
    setStage('capturing')
  }

  function removePhoto(index) {
    setPhotos((prev) => {
      const next = prev.filter((_, i) => i !== index)
      if (next.length === 0) setStage('scan')
      return next
    })
  }

  function startOver() {
    setPhotos([])
    setDuplicateDismissed(false)
    setStage('scan')
  }

  async function submitScan() {
    if (!photos.length) return
    setStage('scanning')
    try {
      const prepared = await Promise.all(
        photos.map(async (p) => ({
          data: dataUrlToBase64(await compressForScan(p.file)),
          mediaType: 'image/jpeg',
          receiptImageUrl: await compressForStorage(p.file),
        }))
      )
      const res = await fetch('/api/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: prepared.map(({ data, mediaType }) => ({ data, mediaType })) }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorKey(data.error || 'scan_failed')
        setStage('error')
        return
      }
      setExtracted({ ...data, receiptImageUrls: prepared.map((p) => p.receiptImageUrl) })
      setStage('review')
    } catch {
      setErrorKey('network')
      setStage('error')
    }
  }

  function updateShared(field, value) {
    setExtracted((prev) => ({ ...prev, [field]: value }))
  }

  function updateItem(index, field, value) {
    setExtracted((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    }))
  }

  function sharedHint(field) {
    if (!extracted.missingFields?.includes(field)) return null
    return <p className="field-hint">{FIELD_HINTS[field]}</p>
  }

  function handleBarcodeDetected(value) {
    if (barcodeTarget != null) updateItem(barcodeTarget, 'barcode', value)
    setBarcodeTarget(null)
  }

  function itemHint(item, field) {
    if (!item.missingFields?.includes(field)) return null
    return <p className="field-hint">{FIELD_HINTS[field]}</p>
  }

  function save() {
    extracted.items.forEach((item, i) => {
      addPurchase({
        store: extracted.store,
        brand: item.brand || extracted.store,
        storeAddress: extracted.storeAddress,
        receiptNumber: extracted.receiptNumber,
        product: item.product,
        size: item.size || null,
        gender: item.gender || null,
        color: item.color || null,
        sku: item.sku || null,
        barcode: item.barcode || null,
        quantity: item.quantity || 1,
        price: Number(item.price),
        currentPrice: Number(item.price),
        purchaseDate: extracted.purchaseDate,
        purchaseTime: extracted.purchaseTime,
        subtotal: extracted.subtotal,
        tax: extracted.tax,
        tip: extracted.tip,
        discount: extracted.discount,
        total: extracted.total,
        paymentMethod: extracted.paymentMethod,
        itemDiscount: item.discount,
        category: item.category,
        returnDeadline: item.returnDeadline,
        returnDeadlineSource: item.returnDeadlineSource,
        warrantyExpires: item.warrantyExpires,
        refund: extracted.refund,
        receiptImageUrls: extracted.receiptImageUrls,
        logoUrl: item.logoUrl,
        id: `p-${Date.now()}-${i}`,
      })
    })
    setStage('saved')
    setTimeout(() => navigate('/'), 700)
  }

  function retry() {
    setExtracted(null)
    setErrorKey(null)
    setPhotos([])
    setDuplicateDismissed(false)
    setStage('scan')
  }

  const canSave =
    extracted?.items?.length > 0 &&
    extracted.items.every((item) => item.product && item.price !== '' && !isNaN(Number(item.price)))

  return (
    <div className="screen">
      {barcodeTarget != null && (
        <BarcodeScanner onDetect={handleBarcodeDetected} onClose={() => setBarcodeTarget(null)} />
      )}

      <button className="back-link" onClick={() => navigate(-1)}>
        <IconChevronLeft />
        Back
      </button>

      <div className="page-header">
        <h1>Add a purchase</h1>
      </div>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          addPhoto(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          addPhoto(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      {stage === 'scan' && (
        <>
          <button className="scan-area" onClick={() => cameraInputRef.current?.click()}>
            <IconCamera />
            <span>Take a photo of your receipt</span>
          </button>
          <p className="scan-area__hint">Make sure the entire receipt is visible.</p>
          <button className="link-action" onClick={() => uploadInputRef.current?.click()}>
            <IconUpload />
            Upload from Photos
          </button>
        </>
      )}

      {stage === 'capturing' && (
        <>
          <p className="confirm-prompt confirm-prompt--top">
            {photos.length} page{photos.length === 1 ? '' : 's'} added. Long receipt? Add more pages below.
          </p>

          <div className="page-strip">
            {photos.map((p, i) => (
              <div className="page-strip__item" key={i}>
                <img src={p.previewUrl} alt={`Page ${i + 1}`} />
                <button className="page-strip__remove" onClick={() => removePhoto(i)} aria-label="Remove page">
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="action-row">
            <button className="btn btn--secondary" onClick={() => cameraInputRef.current?.click()}>
              <IconCamera width={18} height={18} />
              Add Page
            </button>
            <button className="btn btn--secondary" onClick={() => uploadInputRef.current?.click()}>
              <IconUpload width={18} height={18} />
              Upload
            </button>
          </div>

          <button className="btn btn--primary btn--block" onClick={submitScan}>
            Scan {photos.length > 1 ? `${photos.length} Pages` : 'Receipt'}
          </button>
          <button className="link-action" onClick={startOver}>
            Start Over
          </button>
        </>
      )}

      {stage === 'scanning' && (
        <div className="scan-area scan-area--loading">
          <ReceiptScan />
          <span>{SCAN_STEPS[scanStep]}</span>
        </div>
      )}

      {stage === 'error' && (
        <>
          <div className="scan-area scan-area--error">
            <span>{ERROR_MESSAGES[errorKey] || ERROR_MESSAGES.scan_failed}</span>
          </div>
          <button className="btn btn--primary btn--block" onClick={retry}>
            Try Again
          </button>
        </>
      )}

      {stage === 'review' && extracted && (
        <>
          <p className="confirm-prompt confirm-prompt--top">
            {extracted.items.length > 1
              ? `Found ${extracted.items.length} items. Check the details below, then save.`
              : 'Check the details below, then save.'}
          </p>

          {extracted.missingFields?.length > 0 && (
            <div className="missing-fields-note">
              <strong>Couldn't find on this receipt:</strong>{' '}
              {extracted.missingFields.map((f) => FIELD_LABELS[f]).join(', ')}. Fill them in below if you know them.
            </div>
          )}

          {duplicate && !duplicateDismissed && (
            <div className="duplicate-note">
              <strong>This looks like a receipt you already added</strong> — same store, date, and
              {duplicate.receiptNumber && extracted.receiptNumber ? ' receipt number' : ' total'}.
              <div className="duplicate-note__actions">
                <Link to={`/purchases/${duplicate.id}`} className="link-action link-action--inline">
                  View existing purchase
                </Link>
                <button className="link-action link-action--inline" onClick={() => setDuplicateDismissed(true)}>
                  This is a different purchase
                </button>
              </div>
            </div>
          )}

          {extracted.receiptImageUrls?.length > 0 && (
            <div className="receipt-photo receipt-photo--review">
              <div className="page-strip">
                {extracted.receiptImageUrls.map((url, i) => (
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
              <p className="receipt-photo__caption">Your scanned receipt — tap a page to view it closely.</p>
            </div>
          )}

          {viewerIndex !== null && (
            <ReceiptViewer
              images={extracted.receiptImageUrls}
              startIndex={viewerIndex}
              onClose={() => setViewerIndex(null)}
            />
          )}

          <section className="detail-card">
            <div className="field-row">
              <label>Store</label>
              <input
                type="text"
                value={extracted.store}
                onChange={(e) => updateShared('store', e.target.value)}
              />
            </div>
            {sharedHint('store')}
            <div className="field-row">
              <label>Purchased</label>
              <input
                type="date"
                value={extracted.purchaseDate}
                onChange={(e) => updateShared('purchaseDate', e.target.value)}
              />
            </div>
            {sharedHint('purchaseDate')}
            <div className="field-row">
              <label>Time</label>
              <input
                type="time"
                value={extracted.purchaseTime || ''}
                onChange={(e) => updateShared('purchaseTime', e.target.value)}
              />
            </div>
            {sharedHint('purchaseTime')}
            {extracted.storeAddress && (
              <div className="field-row">
                <label>Address</label>
                <span className="field-row__static">{extracted.storeAddress}</span>
              </div>
            )}
            {extracted.receiptNumber && (
              <div className="field-row">
                <label>Receipt #</label>
                <span className="field-row__static">{extracted.receiptNumber}</span>
              </div>
            )}
          </section>

          {(extracted.subtotal != null ||
            extracted.tax != null ||
            extracted.tip != null ||
            extracted.discount != null ||
            extracted.total != null ||
            extracted.paymentMethod) && (
            <section className="detail-card">
              <div className="detail-card__label">Receipt Totals</div>
              {extracted.subtotal != null && (
                <div className="detail-card__row">
                  <span>Subtotal</span>
                  <strong className="text-accent">${Number(extracted.subtotal).toFixed(2)}</strong>
                </div>
              )}
              {extracted.discount != null && (
                <div className="detail-card__row">
                  <span>Discount</span>
                  <strong className="text-warning">-${Number(extracted.discount).toFixed(2)}</strong>
                </div>
              )}
              {extracted.tax != null && (
                <div className="detail-card__row">
                  <span>Tax</span>
                  <strong className="text-accent">${Number(extracted.tax).toFixed(2)}</strong>
                </div>
              )}
              {extracted.tip != null && (
                <div className="detail-card__row">
                  <span>Tip</span>
                  <strong className="text-accent">${Number(extracted.tip).toFixed(2)}</strong>
                </div>
              )}
              {extracted.total != null && (
                <div className="detail-card__row">
                  <span>Total</span>
                  <strong className="text-accent">${Number(extracted.total).toFixed(2)}</strong>
                </div>
              )}
              {extracted.paymentMethod && (
                <div className="detail-card__row">
                  <span>Payment</span>
                  <strong>{extracted.paymentMethod}</strong>
                </div>
              )}
            </section>
          )}

          {extracted.items.map((item, i) => (
            <section key={i} className="detail-card">
              {extracted.items.length > 1 && <div className="detail-card__label">Item {i + 1}</div>}

              <ProductImage purchase={item} />

              <div className="field-row">
                <label>Item</label>
                <input
                  type="text"
                  value={item.product}
                  onChange={(e) => updateItem(i, 'product', e.target.value)}
                />
              </div>
              {itemHint(item, 'product')}
              {item.brand && item.brand !== extracted.store && (
                <div className="field-row">
                  <label>Brand</label>
                  <input
                    type="text"
                    value={item.brand}
                    onChange={(e) => updateItem(i, 'brand', e.target.value)}
                  />
                </div>
              )}
              {item.color != null && (
                <div className="field-row">
                  <label>Color</label>
                  <input
                    type="text"
                    value={item.color || ''}
                    onChange={(e) => updateItem(i, 'color', e.target.value)}
                  />
                </div>
              )}
              {(item.size != null || item.category === 'Apparel') && (
                <div className="field-row">
                  <label>Size</label>
                  <input
                    type="text"
                    value={item.size || ''}
                    onChange={(e) => updateItem(i, 'size', e.target.value)}
                  />
                </div>
              )}
              {(item.gender != null || item.category === 'Apparel') && (
                <div className="field-row">
                  <label>Gender</label>
                  <select value={item.gender || ''} onChange={(e) => updateItem(i, 'gender', e.target.value)}>
                    <option value="">—</option>
                    <option value="Men's">Men's</option>
                    <option value="Women's">Women's</option>
                    <option value="Boys'">Boys'</option>
                    <option value="Girls'">Girls'</option>
                    <option value="Unisex">Unisex</option>
                  </select>
                </div>
              )}
              {item.sku != null && (
                <div className="field-row">
                  <label>SKU</label>
                  <input
                    type="text"
                    value={item.sku || ''}
                    onChange={(e) => updateItem(i, 'sku', e.target.value)}
                  />
                </div>
              )}
              {item.quantity > 1 && (
                <div className="field-row">
                  <label>Quantity</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={item.quantity}
                    onChange={(e) => updateItem(i, 'quantity', e.target.value)}
                  />
                </div>
              )}
              <div className="field-row">
                <label>Price</label>
                <div className="field-row__money">
                  <span>$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={item.price}
                    onChange={(e) => updateItem(i, 'price', e.target.value)}
                  />
                </div>
              </div>
              {itemHint(item, 'price')}
              {item.discount != null && (
                <div className="field-row">
                  <label>Discount</label>
                  <span className="field-row__static text-warning">-${Number(item.discount).toFixed(2)}</span>
                </div>
              )}
              <div className="field-row">
                <label>Return by</label>
                <input
                  type="date"
                  value={item.returnDeadline || ''}
                  onChange={(e) => updateItem(i, 'returnDeadline', e.target.value)}
                />
              </div>
              {item.returnDeadlineSource === 'receipt' && (
                <p className="field-hint field-hint--good">From the receipt's own return policy</p>
              )}
              {item.returnDeadlineSource === 'store_policy' && (
                <p className="field-hint field-hint--good">Based on {extracted.store}'s typical return policy</p>
              )}
              <div className="field-row">
                <label>Warranty until</label>
                <input
                  type="date"
                  value={item.warrantyExpires || ''}
                  onChange={(e) => updateItem(i, 'warrantyExpires', e.target.value)}
                />
              </div>
              {itemHint(item, 'warrantyExpires')}

              <div className="field-row">
                <label>Barcode</label>
                {item.barcode ? (
                  <span className="field-row__static">{item.barcode}</span>
                ) : isBarcodeScanSupported() ? (
                  <button className="link-action link-action--inline" onClick={() => setBarcodeTarget(i)}>
                    <IconBarcode width={15} height={15} />
                    Scan
                  </button>
                ) : (
                  <span className="field-row__static field-row__static--muted">Not supported on this device</span>
                )}
              </div>
              {item.barcode && (
                <button className="link-action" onClick={() => setBarcodeTarget(i)}>
                  Rescan barcode
                </button>
              )}
            </section>
          ))}

          <p className="confirm-prompt">Does everything look correct?</p>
          <button className="btn btn--primary btn--block" disabled={!canSave} onClick={save}>
            {extracted.items.length > 1 ? `Save ${extracted.items.length} Purchases` : 'Save Purchase'}
          </button>
        </>
      )}

      {stage === 'saved' && (
        <div className="scan-area">
          <IconCheck />
          <span>Purchase saved</span>
        </div>
      )}
    </div>
  )
}
