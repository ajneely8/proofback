export default function ProductImage({ purchase }) {
  if (!purchase.imageUrl) return null

  return (
    <div className="product-image">
      <img src={purchase.imageUrl} alt={purchase.product} />
    </div>
  )
}
