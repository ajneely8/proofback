import { useState } from 'react'
import { purchaseLogoUrl } from '../lib/logo.js'

export default function Thumb({ purchase, size = 'md' }) {
  const [failed, setFailed] = useState(false)
  const initial = (purchase.brand || purchase.store || '?').trim().charAt(0).toUpperCase()
  const logoUrl = purchaseLogoUrl(purchase)

  if (logoUrl && !failed) {
    return (
      <div className={`thumb thumb--${size} thumb--logo`}>
        <img src={logoUrl} alt="" onError={() => setFailed(true)} />
      </div>
    )
  }

  return (
    <div className={`thumb thumb--${size} thumb--fallback`}>
      <span>{initial}</span>
    </div>
  )
}
