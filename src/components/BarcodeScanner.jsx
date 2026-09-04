import { useEffect, useRef, useState } from 'react'
import { IconBarcode } from './Icons.jsx'

const FORMATS = ['upc_a', 'upc_e', 'ean_13', 'ean_8', 'code_128', 'code_39', 'itf', 'qr_code']

export function isBarcodeScanSupported() {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window
}

// Opens the device camera and continuously runs the browser's native
// BarcodeDetector against each frame until a code is found. Only decodes a
// number — there's no product database wired up, so the caller is
// responsible for what that number means (e.g. saving it as a reference).
export default function BarcodeScanner({ onDetect, onClose }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef = useRef(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    let detector
    try {
      detector = new window.BarcodeDetector({ formats: FORMATS })
    } catch {
      setError('Barcode scanning isn\'t supported on this device.')
      return
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
        }

        async function tick() {
          if (cancelled || !videoRef.current) return
          try {
            const codes = await detector.detect(videoRef.current)
            if (codes.length > 0) {
              onDetect(codes[0].rawValue)
              return
            }
          } catch {
            // A detect() call can transiently fail on a not-yet-ready video
            // frame — just keep scanning rather than surfacing that to the user.
          }
          rafRef.current = requestAnimationFrame(tick)
        }
        rafRef.current = requestAnimationFrame(tick)
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't access the camera. Check camera permission and try again.")
      })

    return () => {
      cancelled = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
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
