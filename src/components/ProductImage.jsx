import { useState } from 'react'

export default function ProductImage({ purchase }) {
  const [failed, setFailed] = useState(false)
  if (!purchase.logoUrl || failed) return null

  return (
    <div className="product-image">
      <img src={purchase.logoUrl} alt={purchase.brand} onError={() => setFailed(true)} />
    </div>
  )
}
