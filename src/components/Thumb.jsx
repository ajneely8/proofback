import { useMemo, useState } from 'react'
import { purchaseLogoCandidates } from '../lib/logo.js'

export default function Thumb({ purchase, size = 'md' }) {
  const candidates = useMemo(() => purchaseLogoCandidates(purchase), [purchase])
  const [index, setIndex] = useState(0)
  const initial = (purchase.brand || purchase.store || '?').trim().charAt(0).toUpperCase()

  if (index < candidates.length) {
    return (
      <div className={`thumb thumb--${size} thumb--logo`}>
        <img src={candidates[index]} alt="" onError={() => setIndex((i) => i + 1)} />
      </div>
    )
  }

  return (
    <div className={`thumb thumb--${size} thumb--fallback`}>
      <span>{initial}</span>
    </div>
  )
}
