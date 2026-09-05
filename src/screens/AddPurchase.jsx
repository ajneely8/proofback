import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePurchases } from '../lib/PurchasesContext.jsx'
import { IconCamera, IconUpload, IconChevronLeft, IconCheck, IconBarcode } from '../components/Icons.jsx'
import ProductImage from '../components/ProductImage.jsx'
import BarcodeScanner, { isBarcodeScanSupported } from '../components/BarcodeScanner.jsx'

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result
      const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Keeps a copy of each scanned receipt page so it stays viewable on the
// purchase later, without ballooning localStorage — downscaled and
// re-encoded as a compressed JPEG rather than stored at full camera
// resolution.
function compressReceiptImage(file, maxWidth = 700, quality = 0.7) {
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
  rate_limited: "You've used up today's free scans. Try again later, or add billing to your Gemini API key for a higher limit.",
  model_overloaded: "Gemini is overloaded right now. Wait a moment and try again — this isn't something on our end.",
}

export default function AddPurchase() {
  const [stage, setStage] = useState('scan') // scan | capturing | scanning | review | error | saved
  const [photos, setPhotos] = useState([]) // [{ file, previewUrl }]
  const [extracted, setExtracted] = useState(null)
  const [errorKey, setErrorKey] = useState(null)
  const [scanStep, setScanStep] = useState(0)
  const [barcodeTarget, setBarcodeTarget] = useState(null) // item index currently being scanned
  const { addPurchase } = usePurchases()
  const navigate = useNavigate()
  const cameraInputRef = useRef(null)
  const uploadInputRef = useRef(null)

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
    setStage('scan')
  }

  async function submitScan() {
    if (!photos.length) return
    setStage('scanning')
    try {
      const prepared = await Promise.all(
        photos.map(async (p) => ({
          data: await readFileAsBase64(p.file),
          mediaType: p.file.type || 'image/jpeg',
          receiptImageUrl: await compressReceiptImage(p.file),
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
          <div className="spinner" />
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

          {extracted.receiptImageUrls?.length > 0 && (
            <div className="receipt-photo receipt-photo--review">
              <div className="page-strip">
                {extracted.receiptImageUrls.map((url, i) => (
                  <img key={i} src={url} alt={`Receipt page ${i + 1}`} className="page-strip__photo" />
                ))}
              </div>
              <p className="receipt-photo__caption">Your scanned receipt — saved so you can look back at it later.</p>
            </div>
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
                  <strong>${Number(extracted.subtotal).toFixed(2)}</strong>
                </div>
              )}
              {extracted.discount != null && (
                <div className="detail-card__row">
                  <span>Discount</span>
                  <strong className="text-accent">-${Number(extracted.discount).toFixed(2)}</strong>
                </div>
              )}
              {extracted.tax != null && (
                <div className="detail-card__row">
                  <span>Tax</span>
                  <strong>${Number(extracted.tax).toFixed(2)}</strong>
                </div>
              )}
              {extracted.tip != null && (
                <div className="detail-card__row">
                  <span>Tip</span>
                  <strong>${Number(extracted.tip).toFixed(2)}</strong>
                </div>
              )}
              {extracted.total != null && (
                <div className="detail-card__row">
                  <span>Total</span>
                  <strong>${Number(extracted.total).toFixed(2)}</strong>
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
                <input
                  type="number"
                  step="0.01"
                  value={item.price}
                  onChange={(e) => updateItem(i, 'price', e.target.value)}
                />
              </div>
              {itemHint(item, 'price')}
              {item.discount != null && (
                <div className="field-row">
                  <label>Discount</label>
                  <span className="field-row__static text-accent">-${Number(item.discount).toFixed(2)}</span>
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
