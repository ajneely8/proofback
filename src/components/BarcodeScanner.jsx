import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { IconBarcode } from './Icons.jsx'

export function isBarcodeScanSupported() {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
}

// Opens the device camera and continuously decodes frames with ZXing (a
// JS/WASM barcode reader, not a browser API) so this works on every modern
// browser — including desktop Chrome and iPhone Safari, which never
// implemented the native BarcodeDetector API this used before. There's no
// product database wired up, so the caller is responsible for what the
// decoded number means (e.g. saving it as a reference).
export default function BarcodeScanner({ onDetect, onClose }) {
  const videoRef = useRef(null)
  const readerRef = useRef(null)
  const controlsRef = useRef(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    const reader = new BrowserMultiFormatReader()
    readerRef.current = reader

    reader
      .decodeFromConstraints(
        { video: { facingMode: 'environment' } },
        videoRef.current,
        (result, err, controls) => {
          controlsRef.current = controls
          if (cancelled) return
          if (result) {
            controls.stop()
            onDetect(result.getText())
          }
        }
      )
      .catch(() => {
        if (!cancelled) setError("Couldn't access the camera. Check camera permission and try again.")
      })

    return () => {
      cancelled = true
      controlsRef.current?.stop()
    }
  }, [onDetect])

  return (
    <div className="barcode-scanner">
      <div className="barcode-scanner__frame">
        {error ? (
          <div className="barcode-scanner__error">
            <IconBarcode width={28} height={28} />
            <span>{error}</span>
          </div>
        ) : (
          <>
            <video ref={videoRef} className="barcode-scanner__video" muted playsInline />
            <div className="barcode-scanner__reticle" />
          </>
        )}
      </div>
      <p className="barcode-scanner__hint">
        {error ? '' : "Point the camera at the item's barcode."}
      </p>
      <button className="btn btn--secondary btn--block" onClick={onClose}>
        Cancel
      </button>
    </div>
  )
}
