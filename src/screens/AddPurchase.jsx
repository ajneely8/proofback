import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePurchases } from '../lib/PurchasesContext.jsx'
import { IconCamera, IconUpload, IconChevronLeft, IconCheck } from '../components/Icons.jsx'
import ProductImage from '../components/ProductImage.jsx'

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

const ERROR_MESSAGES = {
  no_receipt_detected: "We couldn't read a receipt in that photo. Try again with better lighting.",
  server_missing_api_key: 'Receipt scanning is not set up yet. Add an Anthropic API key to the server.',
  missing_image: 'No photo was received. Try again.',
  extraction_failed: "We couldn't read that receipt. Try again.",
  scan_failed: 'Something went wrong scanning that receipt. Try again.',
  network: "Couldn't reach the scan service. Check your connection and try again.",
}

export default function AddPurchase() {
  const [stage, setStage] = useState('scan') // scan | scanning | review | error | saved
  const [extracted, setExtracted] = useState(null)
  const [errorKey, setErrorKey] = useState(null)
  const { addPurchase } = usePurchases()
  const navigate = useNavigate()
  const cameraInputRef = useRef(null)
  const uploadInputRef = useRef(null)

  async function handleFile(file) {
    if (!file) return
    setStage('scanning')
    try {
      const imageBase64 = await readFileAsBase64(file)
      const res = await fetch('/api/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, mediaType: file.type || 'image/jpeg' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorKey(data.error || 'scan_failed')
        setStage('error')
        return
      }
      setExtracted(data)
      setStage('review')
    } catch {
      setErrorKey('network')
      setStage('error')
    }
  }

  function updateField(field, value) {
    setExtracted((prev) => ({ ...prev, [field]: value }))
  }

  function save() {
    addPurchase({
      ...extracted,
      price: Number(extracted.price),
      currentPrice: Number(extracted.price),
      id: `p-${Date.now()}`,
    })
    setStage('saved')
    setTimeout(() => navigate('/'), 700)
  }

  function retry() {
    setExtracted(null)
    setErrorKey(null)
    setStage('scan')
  }

  return (
    <div className="screen">
      <button className="back-link" onClick={() => navigate(-1)}>
        <IconChevronLeft />
        Back
      </button>

      <div className="page-header">
        <h1>Add a purchase</h1>
      </div>

      {stage === 'scan' && (
        <>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <input
            ref={uploadInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => handleFile(e.target.files?.[0])}
          />

          <button className="scan-area" onClick={() => cameraInputRef.current?.click()}>
            <IconCamera />
            <span>Take a photo of your receipt</span>
          </button>
          <button className="link-action" onClick={() => uploadInputRef.current?.click()}>
            <IconUpload />
            Upload from Photos
          </button>
        </>
      )}

      {stage === 'scanning' && (
        <div className="scan-area scan-area--loading">
          <div className="spinner" />
          <span>Reading receipt…</span>
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
          <p className="confirm-prompt confirm-prompt--top">Check the details below, then save.</p>

          <ProductImage purchase={extracted} />

          <section className="detail-card">
            <div className="field-row">
              <label>Store</label>
              <input
                type="text"
                value={extracted.store}
                onChange={(e) => updateField('store', e.target.value)}
              />
            </div>
            <div className="field-row">
              <label>Item</label>
              <input
                type="text"
                value={extracted.product}
                onChange={(e) => updateField('product', e.target.value)}
              />
            </div>
            <div className="field-row">
              <label>Price</label>
              <input
                type="number"
                step="0.01"
                value={extracted.price}
                onChange={(e) => updateField('price', e.target.value)}
              />
            </div>
            <div className="field-row">
              <label>Purchased</label>
              <input
                type="date"
                value={extracted.purchaseDate}
                onChange={(e) => updateField('purchaseDate', e.target.value)}
              />
            </div>
            <div className="field-row">
              <label>Time</label>
              <input
                type="time"
                value={extracted.purchaseTime || ''}
                onChange={(e) => updateField('purchaseTime', e.target.value)}
              />
            </div>
            <div className="field-row">
              <label>Return by</label>
              <input
                type="date"
                value={extracted.returnDeadline || ''}
                onChange={(e) => updateField('returnDeadline', e.target.value)}
              />
            </div>
            <div className="field-row">
              <label>Warranty until</label>
              <input
                type="date"
                value={extracted.warrantyExpires || ''}
                onChange={(e) => updateField('warrantyExpires', e.target.value)}
              />
            </div>
          </section>

          <p className="confirm-prompt">Does everything look correct?</p>
          <button className="btn btn--primary btn--block" onClick={save}>
            Save Purchase
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
