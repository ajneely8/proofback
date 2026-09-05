import { useState } from 'react'
import { IconChevronLeft, IconChevronRight } from './Icons.jsx'

// A full-screen look at a receipt photo — pinch-to-zoom is native browser
// behavior here (nothing disables it), this just gets the image big enough,
// and off the rest of the page, to actually make use of that.
export default function ReceiptViewer({ images, startIndex = 0, onClose }) {
  const [index, setIndex] = useState(startIndex)
  const hasMultiple = images.length > 1

  function prev(e) {
    e.stopPropagation()
    setIndex((i) => (i - 1 + images.length) % images.length)
  }

  function next(e) {
    e.stopPropagation()
    setIndex((i) => (i + 1) % images.length)
  }

  function save(e) {
    e.stopPropagation()
    const a = document.createElement('a')
    a.href = images[index]
    a.download = `receipt-page-${index + 1}.jpg`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div className="receipt-viewer" onClick={onClose}>
      <button className="receipt-viewer__save" onClick={save} aria-label="Save this photo">
        Save
      </button>
      <button className="receipt-viewer__close" onClick={onClose} aria-label="Close">
        ×
      </button>

      <div className="receipt-viewer__stage" onClick={(e) => e.stopPropagation()}>
        <img src={images[index]} alt={`Receipt page ${index + 1}`} />
      </div>

      {hasMultiple && (
        <>
          <button className="receipt-viewer__nav receipt-viewer__nav--prev" onClick={prev} aria-label="Previous page">
            <IconChevronLeft />
          </button>
          <button className="receipt-viewer__nav receipt-viewer__nav--next" onClick={next} aria-label="Next page">
            <IconChevronRight />
          </button>
          <div className="receipt-viewer__count">
            Page {index + 1} of {images.length}
          </div>
        </>
      )}
    </div>
  )
}
