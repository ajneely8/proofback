export default function Thumb({ purchase, size = 'md' }) {
  const initial = (purchase.brand || purchase.store || '?').trim().charAt(0).toUpperCase()

  if (purchase.imageUrl) {
    return (
      <div className={`thumb thumb--${size}`}>
        <img src={purchase.imageUrl} alt="" />
      </div>
    )
  }

  return (
    <div className={`thumb thumb--${size} thumb--fallback`}>
      <span>{initial}</span>
    </div>
  )
}
