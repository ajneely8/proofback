import { useMemo, useState } from 'react'
import { purchaseLogoCandidates } from '../lib/logo.js'

export default function ProductImage({ purchase }) {
  const candidates = useMemo(() => purchaseLogoCandidates(purchase), [purchase])
  const [index, setIndex] = useState(0)
  if (index >= candidates.length) return null

  return (
    <div className="product-image">
      <img src={candidates[index]} alt={purchase.brand} onError={() => setIndex((i) => i + 1)} />
    </div>
  )
}
