import { useState } from 'react'
import { purchaseLogoUrl } from '../lib/logo.js'

export default function ProductImage({ purchase }) {
  const [failed, setFailed] = useState(false)
  const logoUrl = purchaseLogoUrl(purchase)
  if (!logoUrl || failed) return null

  return (
    <div className="product-image">
      <img src={logoUrl} alt={purchase.brand} onError={() => setFailed(true)} />
    </div>
  )
}
