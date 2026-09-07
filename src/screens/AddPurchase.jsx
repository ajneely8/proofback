import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { usePurchases } from '../lib/PurchasesContext.jsx'
import { useAuth } from '../lib/AuthContext.jsx'
import { useSettings } from '../lib/SettingsContext.jsx'
import { FREE_PURCHASE_LIMIT } from '../data/mockData.js'
import { IconCamera, IconUpload, IconChevronLeft, IconCheck, IconBarcode } from '../components/Icons.jsx'
import ProductImage from '../components/ProductImage.jsx'
import BarcodeScanner, { isBarcodeScanSupported } from '../components/BarcodeScanner.jsx'
import ReceiptViewer from '../components/ReceiptViewer.jsx'
import { ReceiptScan } from '../components/OnboardingVisuals.jsx'
import { normalizeProductName, normalizeBrandName } from '../lib/normalizeProduct.js'
import { updateInboxItem } from '../lib/receiptInbox.js'
import { incrementAnonScanCount, getAnonScanCount, ANON_FREE_SCAN_LIMIT } from '../lib/storage.js'

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
// with several pages attached. Deliberately the UNCROPPED photo — full
// context (including edges) helps the model read the receipt; cropping only
// happens to the copy that gets saved/displayed, via cropAndCompress below.
function compressForScan(file) {
  return compressImage(file, 1500, 0.82)
}

// Crops to just the receipt (per the model's own pageBoundingBoxes reading
// of this same photo) before downscaling for storage — so what gets saved
// and shown is the receipt itself, not the table/background/hands around
// it. `box` is {x, y, width, height} as 0-1 fractions of the full image; a
// missing/invalid box falls back to the full frame rather than failing.
function cropAndCompress(file, box, maxWidth = 700, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const valid =
          box &&
          [box.x, box.y, box.width, box.height].every((n) => typeof n === 'number' && n >= 0 && n <= 1) &&
          box.width > 0.05 &&
          box.height > 0.05
        const cx = valid ? box.x : 0
        const cy = valid ? box.y : 0
        const cw = valid ? box.width : 1
        const ch = valid ? box.height : 1

        const sx = cx * img.width
        const sy = cy * img.height
        const sw = cw * img.width
        const sh = ch * img.height

        const scale = Math.min(1, maxWidth / sw)
        const canvas = document.createElement('canvas')
        canvas.width = sw * scale
        canvas.height = sh * scale
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = reject
      img.src = reader.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function dataUrlToBase64(dataUrl) {
  return dataUrl.slice(dataUrl.indexOf(',') + 1)
}

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Flags a likely re-scan of a receipt already saved — same store and date,
// plus either a matching receipt number or a matching total (whichever both
// records have), rather than blocking the save outright, since it's only a
// guess and a real duplicate purchase (two separate trips, same store, same
// day) is possible.
function findDuplicateReceipt(extracted, purchases) {
  if (!extracted?.store || !extracted?.purchaseDate) return null
  const store = extracted.store.trim().toLowerCase()
  const extractedProducts = new Set((extracted.items || []).map((it) => (it.product || '').trim().toLowerCase()))
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
      // Weaker signals when there's no receipt number/total to compare —
      // still store+date, but only counted a match alongside a matching
      // payment method or at least one shared item name.
      const paymentMatches = extracted.paymentMethod && p.paymentMethod && extracted.paymentMethod === p.paymentMethod
      const itemMatches = p.product && extractedProducts.has(p.product.trim().toLowerCase())
      return Boolean(paymentMatches || itemMatches)
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

const DOCUMENT_TYPE_LABELS = {
  return_receipt: 'a return receipt',
  exchange_receipt: 'an exchange receipt',
  gift_receipt: 'a gift receipt',
  benefit_receipt: 'a benefit receipt',
  invoice: 'an invoice',
  order_confirmation: 'an order confirmation',
  refund_confirmation: 'a refund confirmation',
}

const QUALITY_ISSUE_LABELS = {
  blur: 'blurry',
  glare: 'glare',
  shadow: 'shadow',
  cropped: 'cropped',
  low_contrast: 'low contrast',
  wrong_orientation: 'wrong orientation',
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
  scan_limit_reached: "You've used all your free scans this month. Upgrade to Premium in Profile for unlimited scans, or use Enter Manually instead.",
}

export default function AddPurchase() {
  const [stage, setStage] = useState('scan') // scan | capturing | scanning | review | error | saved
  const [photos, setPhotos] = useState([]) // [{ file, previewUrl }]
  const [extracted, setExtracted] = useState(null)
  const [errorKey, setErrorKey] = useState(null)
  const [scanStep, setScanStep] = useState(0)
  const [barcodeTarget, setBarcodeTarget] = useState(null) // item index currently being scanned
  const [retakeIndex, setRetakeIndex] = useState(null) // receipt page index currently being retaken
  const retakeInputRef = useRef(null)
  const [viewerIndex, setViewerIndex] = useState(null) // receipt page index currently being viewed closely
  const [duplicateDismissed, setDuplicateDismissed] = useState(false)
  const [reviewChecked, setReviewChecked] = useState(false)
  const [manualForm, setManualForm] = useState({
    store: '',
    product: '',
    price: '',
    category: 'Other',
    purchaseDate: todayISO(),
  })
  const { addPurchase, updatePurchase, purchases } = usePurchases()
  const [attachStatus, setAttachStatus] = useState(null)
  const [savedInfo, setSavedInfo] = useState(null) // { firstId, groupId, count }
  const { session } = useAuth()
  const { settings } = useSettings()
  const navigate = useNavigate()
  const location = useLocation()
  const inboxEntryId = location.state?.inboxEntryId || null
  const cameraInputRef = useRef(null)
  const uploadInputRef = useRef(null)

  // Arriving from the Receipt Inbox's "Upload" button — skip straight to
  // scanning the handed-off file instead of showing the camera/upload
  // picker again, reusing this exact same pipeline rather than a parallel
  // one built just for the inbox.
  useEffect(() => {
    const file = location.state?.inboxFile
    if (!file) return
    const nextPhotos = [{ file, previewUrl: URL.createObjectURL(file) }]
    setPhotos(nextPhotos)
    submitScan(nextPhotos)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const duplicate = useMemo(
    () => (extracted ? findDuplicateReceipt(extracted, purchases) : null),
    [extracted, purchases]
  )

  function attachToExisting() {
    if (!duplicate || !extracted) return
    updatePurchase(duplicate.id, {
      receiptImageUrls: [...(duplicate.receiptImageUrls || []), ...(extracted.receiptImageUrls || [])],
    })
    setAttachStatus('attached')
    setTimeout(() => navigate(`/purchases/${duplicate.id}`), 900)
  }

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

  // Replaces just one page's photo and re-runs the scan on the full set —
  // a changed page can change the extracted totals/items, so this can't
  // just patch the one image without re-reading the receipt.
  function retakePage(index, file) {
    if (!file || index == null) return
    const nextPhotos = photos.map((p, i) => (i === index ? { file, previewUrl: URL.createObjectURL(file) } : p))
    setPhotos(nextPhotos)
    submitScan(nextPhotos)
  }

  async function submitScan(photosOverride) {
    const activePhotos = photosOverride || photos
    if (!activePhotos.length) return
    setStage('scanning')
    try {
      const prepared = await Promise.all(
        activePhotos.map(async (p) => ({
          data: dataUrlToBase64(await compressForScan(p.file)),
          mediaType: 'image/jpeg',
        }))
      )
      const res = await fetch('/api/scan-receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ images: prepared.map(({ data, mediaType }) => ({ data, mediaType })) }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorKey(data.error || 'scan_failed')
        setStage('error')
        if (inboxEntryId) updateInboxItem(inboxEntryId, { status: 'needs_review' })
        return
      }
      // Cropped to just the receipt using the model's own reading of where
      // it sits in each photo (falls back to the full frame per-page when
      // no usable box came back for that page).
      const receiptImageUrls = await Promise.all(
        activePhotos.map((p, i) => cropAndCompress(p.file, data.pageBoundingBoxes?.[i]))
      )
      if (photosOverride) setPhotos(activePhotos)
      setExtracted({ ...data, receiptImageUrls })
      setReviewChecked(false)
      setStage('review')
      // Counts toward the free-scan limit only for a visitor who hasn't
      // signed up yet, and only for a real successful extraction — never
      // for manual entry (submitManual doesn't run this code) and never
      // for a failed/blurry attempt (the !res.ok branch above returns
      // before reaching here).
      if (!session) incrementAnonScanCount()
      if (inboxEntryId) {
        const needsReviewNow =
          data.missingFields?.length > 0 ||
          data.uncertainFields?.length > 0 ||
          data.imageQualityIssues?.some((issues) => issues.length > 0) ||
          data.items?.some((item) => item.missingFields?.length > 0 || item.uncertainFields?.length > 0)
        if (needsReviewNow) updateInboxItem(inboxEntryId, { status: 'needs_review' })
      }
    } catch {
      setErrorKey('network')
      setStage('error')
      if (inboxEntryId) updateInboxItem(inboxEntryId, { status: 'needs_review' })
    }
  }

  // Builds the same shape /api/scan-receipt returns, so manual entry can
  // reuse the entire review/edit screen below rather than needing its own
  // separate save path — return/warranty dates are just left blank here for
  // the user to fill in themselves, same as when a receipt doesn't state one.
  function submitManual() {
    const { store, product, price, category, purchaseDate } = manualForm
    // Mirrors server/scanReceipt.js's WARRANTY_YEARS classification (which
    // categories ever get a warranty at all) — manual entry has no receipt
    // to read a warranty length off of, so eligible items start out
    // 'not_confirmed' rather than guessing a length.
    const warrantyEligible = category === 'Electronics' || category === 'Home'
    setExtracted({
      store,
      brand: store,
      storeAddress: null,
      receiptNumber: null,
      purchaseDate,
      purchaseTime: null,
      subtotal: null,
      tax: null,
      tip: null,
      discount: null,
      total: null,
      paymentMethod: null,
      refund: { status: 'not_applicable' },
      missingFields: [],
      receiptImageUrls: [],
      items: [
        {
          product,
          brand: store,
          size: null,
          gender: null,
          color: null,
          sku: null,
          quantity: 1,
          price: Number(price),
          discount: null,
          category,
          returnDeadline: null,
          returnDeadlineSource: 'estimated',
          warrantyEligible,
          warrantyExpires: null,
          warrantyStatus: warrantyEligible ? 'not_confirmed' : null,
          warrantyExpiresSource: null,
          warrantyProvider: null,
          missingFields: [],
          logoUrl: null,
        },
      ],
    })
    setReviewChecked(false)
    setStage('review')
  }

  function updateShared(field, value) {
    setExtracted((prev) => ({ ...prev, [field]: value }))
    setReviewChecked(false)
  }

  function updateItem(index, field, value) {
    setExtracted((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    }))
    setReviewChecked(false)
  }

  function sharedHint(field) {
    if (extracted.missingFields?.includes(field)) {
      return <p className="field-hint">{FIELD_HINTS[field]}</p>
    }
    if (extracted.uncertainFields?.includes(field)) {
      return <p className="field-hint field-hint--uncertain">Double-check this — the receipt was hard to read here.</p>
    }
    return null
  }

  function handleBarcodeDetected(value) {
    if (barcodeTarget != null) updateItem(barcodeTarget, 'barcode', value)
    setBarcodeTarget(null)
  }

  function itemHint(item, field) {
    if (item.missingFields?.includes(field)) {
      return <p className="field-hint">{FIELD_HINTS[field]}</p>
    }
    if (item.uncertainFields?.includes(field)) {
      return <p className="field-hint field-hint--uncertain">Double-check this — the receipt was hard to read here.</p>
    }
    return null
  }

  function save() {
    // One id per save — stamped on every item from this receipt/entry so
    // they can always be grouped back together later ("combine receipts
    // from the same place"), regardless of whether the receipt printed a
    // receipt number.
    const receiptGroupId = `grp-${Date.now()}`
    let firstId = null
    extracted.items.forEach((item, i) => {
      const brand = normalizeBrandName(item.brand || extracted.store)
      const id = `p-${Date.now()}-${i}`
      if (i === 0) firstId = id
      addPurchase({
        store: extracted.store,
        brand,
        storeAddress: extracted.storeAddress,
        receiptNumber: extracted.receiptNumber,
        receiptGroupId,
        documentType: extracted.documentType || 'purchase_receipt',
        product: normalizeProductName(item.product, brand),
        size: item.size || null,
        gender: item.gender || null,
        color: item.color || null,
        sku: item.sku || null,
        modelNumber: item.modelNumber || null,
        barcode: item.barcode || null,
        quantity: item.quantity || 1,
        price: Number(item.price),
        purchaseDate: extracted.purchaseDate,
        purchaseTime: extracted.purchaseTime,
        subtotal: extracted.subtotal,
        tax: extracted.tax,
        tip: extracted.tip,
        discount: extracted.discount,
        feeAmount: extracted.feeAmount ?? null,
        feeLabel: extracted.feeLabel || null,
        total: extracted.total,
        paymentMethod: extracted.paymentMethod,
        itemDiscount: item.discount,
        category: item.category,
        returnDeadline: item.returnDeadline,
        returnDeadlineSource: item.returnDeadlineSource,
        warrantyEligible: !!item.warrantyEligible,
        warrantyExpires: item.warrantyExpires,
        warrantyStatus: item.warrantyStatus || null,
        warrantyExpiresSource: item.warrantyExpiresSource || null,
        warrantyProvider: item.warrantyProvider || null,
        warrantyStartDate: item.warrantyEligible ? extracted.purchaseDate : null,
        serialNumber: item.serialNumber || null,
        orderNumber: item.orderNumber || null,
        refund: extracted.refund,
        receiptImageUrls: extracted.receiptImageUrls,
        logoUrl: item.logoUrl,
        id,
      })
      triggerRecallCheck(id, brand, normalizeProductName(item.product, brand))
    })
    setSavedInfo({ firstId, groupId: receiptGroupId, count: extracted.items.length })
    setStage('saved')
    if (inboxEntryId) updateInboxItem(inboxEntryId, { status: 'processed', purchaseId: firstId })
  }

  function viewSavedPurchase() {
    if (!savedInfo) return
    navigate(savedInfo.count > 1 ? `/receipt/${encodeURIComponent(savedInfo.groupId)}` : `/purchases/${savedInfo.firstId}`)
  }

  // Fires a best-effort CPSC recall lookup after a purchase is saved —
  // never awaited, never blocks the save/navigate flow, and fails silently.
  // Only worth checking when there's a real brand+product to search for;
  // a manual entry with a vague name would just waste the request.
  function triggerRecallCheck(id, brand, product) {
    if (!brand || !product) return
    fetch('/api/check-recall', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ query: `${brand} ${product}` }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((result) => {
        if (result) updatePurchase(id, { recallCheck: { ...result, checkedAt: todayISO() } })
      })
      .catch(() => {})
  }

  function retry() {
    setExtracted(null)
    setErrorKey(null)
    setPhotos([])
    setDuplicateDismissed(false)
    setStage('scan')
  }

  const needsReview =
    extracted?.missingFields?.length > 0 ||
    extracted?.uncertainFields?.length > 0 ||
    extracted?.imageQualityIssues?.some((issues) => issues.length > 0) ||
    extracted?.items?.some(
      (item) =>
        item.missingFields?.length > 0 ||
        item.uncertainFields?.length > 0 ||
        item.returnDeadlineSource === 'estimated'
    )

  const canSave =
    extracted?.items?.length > 0 &&
    extracted.items.every((item) => item.product && item.price !== '' && !isNaN(Number(item.price))) &&
    (!needsReview || reviewChecked)

  // How many scans are left under whatever plan applies right now — a
  // signed-out visitor's free-scan allowance (ANON_FREE_SCAN_LIMIT), a
  // logged-in Free plan's purchase cap (mirrors the "X of 10 purchases
  // used" count already shown on the Subscription screen), or unlimited
  // for Pro/Family.
  const plan = settings.plan || 'free'
  const scanStatusText = !session
    ? `${Math.max(0, ANON_FREE_SCAN_LIMIT - getAnonScanCount())} of ${ANON_FREE_SCAN_LIMIT} free scans left`
    : plan === 'free'
      ? `${Math.max(0, FREE_PURCHASE_LIMIT - purchases.length)} of ${FREE_PURCHASE_LIMIT} free scans left`
      : 'Unlimited scans'

  return (
    <div className="screen">
      {barcodeTarget != null && (
        <BarcodeScanner onDetect={handleBarcodeDetected} onClose={() => setBarcodeTarget(null)} />
      )}

      <button className="back-link" onClick={() => navigate(-1)}>
        <IconChevronLeft />
        Back
      </button>

      <div className="page-header page-header--row">
        <h1>Add a purchase</h1>
        <span className="scan-status-badge">{scanStatusText}</span>
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
      <input
        ref={retakeInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          retakePage(retakeIndex, e.target.files?.[0])
          e.target.value = ''
        }}
      />

      {stage === 'scan' && (
        <>
          <button className="scan-area" onClick={() => cameraInputRef.current?.click()}>
            <span className="scan-area__icon">
              <IconCamera />
            </span>
            <span>Take a photo of your receipt</span>
          </button>
          <p className="scan-area__hint">Make sure the entire receipt is visible.</p>
          <button className="link-action" onClick={() => uploadInputRef.current?.click()}>
            <IconUpload />
            Upload from Photos
          </button>
          <button className="link-action" onClick={() => setStage('manual')}>
            Enter Manually
          </button>
        </>
      )}

      {stage === 'manual' && (
        <>
          <p className="confirm-prompt confirm-prompt--top">
            No receipt? Enter the basics — you can fill in return/warranty dates on the next screen.
          </p>
          <section className="detail-card">
            <div className="field-row">
              <label>Store</label>
              <input type="text" value={manualForm.store} onChange={(e) => setManualForm((f) => ({ ...f, store: e.target.value }))} autoFocus />
            </div>
            <div className="field-row">
              <label>Item</label>
              <input type="text" value={manualForm.product} onChange={(e) => setManualForm((f) => ({ ...f, product: e.target.value }))} />
            </div>
            <div className="field-row">
              <label>Price</label>
              <div className="field-row__money">
                <span>$</span>
                <input
                  type="number"
                  step="0.01"
                  value={manualForm.price}
                  onChange={(e) => setManualForm((f) => ({ ...f, price: e.target.value }))}
                />
              </div>
            </div>
            <div className="field-row">
              <label>Category</label>
              <select value={manualForm.category} onChange={(e) => setManualForm((f) => ({ ...f, category: e.target.value }))}>
                <option>Electronics</option>
                <option>Apparel</option>
                <option>Home</option>
                <option>Grocery</option>
                <option>Dining</option>
                <option>Other</option>
              </select>
            </div>
            <div className="field-row">
              <label>Purchased</label>
              <input
                type="date"
                value={manualForm.purchaseDate}
                onChange={(e) => setManualForm((f) => ({ ...f, purchaseDate: e.target.value }))}
              />
            </div>
          </section>
          <button
            className="btn btn--primary btn--block"
            disabled={!manualForm.store || !manualForm.product || manualForm.price === ''}
            onClick={submitManual}
          >
            Continue
          </button>
          <button className="link-action" onClick={() => setStage('scan')}>
            Cancel
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

          <button className="btn btn--primary btn--block" onClick={() => submitScan()}>
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

          {extracted.documentType && extracted.documentType !== 'purchase_receipt' && (
            <div className="missing-fields-note">
              <strong>This looks like {DOCUMENT_TYPE_LABELS[extracted.documentType] || 'a different kind of document'}</strong>,
              not a new purchase receipt — check Purchases for an existing record to update instead of saving this
              as a brand-new one.
            </div>
          )}

          {extracted.imageQualityIssues?.some((issues) => issues.length > 0) && (
            <div className="missing-fields-note">
              <strong>Some pages may be hard to read:</strong>{' '}
              {extracted.imageQualityIssues
                .map((issues, i) => (issues.length ? `Page ${i + 1} (${issues.map((iss) => QUALITY_ISSUE_LABELS[iss] || iss).join(', ')})` : null))
                .filter(Boolean)
                .join('; ')}
              . Retake an affected page below if the details look wrong.
            </div>
          )}

          {duplicate && !duplicateDismissed && (
            <div className="duplicate-note">
              <strong>This looks like a receipt you already added</strong> — same store, date, and
              {duplicate.receiptNumber && extracted.receiptNumber ? ' receipt number' : duplicate.total != null && extracted.total != null ? ' total' : ' items or payment method'}.
              <div className="duplicate-note__actions">
                <Link to={`/purchases/${duplicate.id}`} className="link-action link-action--inline">
                  View existing purchase
                </Link>
                <button className="link-action link-action--inline" onClick={attachToExisting}>
                  Attach to existing purchase
                </button>
                <button className="link-action link-action--inline" onClick={() => setDuplicateDismissed(true)}>
                  This is a different purchase
                </button>
              </div>
              {attachStatus === 'attached' && <p className="field-hint field-hint--good">Attached — opening it…</p>}
            </div>
          )}

          {extracted.receiptImageUrls?.length > 0 && (
            <div className="receipt-photo receipt-photo--review">
              <div className="page-strip">
                {extracted.receiptImageUrls.map((url, i) => (
                  <div key={i} className="page-strip__item">
                    <button
                      className="page-strip__photo-btn"
                      onClick={() => setViewerIndex(i)}
                      aria-label={`View receipt page ${i + 1} closely`}
                    >
                      <img src={url} alt={`Receipt page ${i + 1}`} className="page-strip__photo" />
                    </button>
                    {extracted.imageQualityIssues?.[i]?.length > 0 && (
                      <button
                        className="link-action link-action--inline"
                        onClick={() => {
                          setRetakeIndex(i)
                          retakeInputRef.current?.click()
                        }}
                      >
                        Retake this page
                      </button>
                    )}
                  </div>
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
                  <strong className="text-accent">+${Number(extracted.tax).toFixed(2)}</strong>
                </div>
              )}
              {extracted.tip != null && (
                <div className="detail-card__row">
                  <span>Tip</span>
                  <strong className="text-accent">+${Number(extracted.tip).toFixed(2)}</strong>
                </div>
              )}
              {extracted.feeAmount != null && (
                <div className="detail-card__row">
                  <span>{extracted.feeLabel || 'Fee'}</span>
                  <strong className="text-accent">+${Number(extracted.feeAmount).toFixed(2)}</strong>
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

          {needsReview && (
            <label className="review-confirm">
              <input
                type="checkbox"
                checked={reviewChecked}
                onChange={(e) => setReviewChecked(e.target.checked)}
              />
              <span>
                Some fields are missing, uncertain, or estimated (highlighted above) — I've reviewed and corrected what I can.
              </span>
            </label>
          )}

          <button className="btn btn--primary btn--block" disabled={!canSave} onClick={save}>
            {extracted.items.length > 1 ? `Save ${extracted.items.length} Purchases` : 'Save Purchase'}
          </button>
        </>
      )}

      {stage === 'saved' && (
        <>
          <div className="scan-area">
            <IconCheck />
            <span>{savedInfo?.count > 1 ? `${savedInfo.count} purchases saved` : 'Purchase saved'}</span>
          </div>
          <button className="btn btn--primary btn--block" onClick={viewSavedPurchase}>
            View Purchase
          </button>
          <button className="link-action" onClick={() => navigate('/')}>
            Done
          </button>
        </>
      )}
    </div>
  )
}
