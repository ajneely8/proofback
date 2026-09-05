import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePurchases } from '../lib/PurchasesContext.jsx'
import { formatDate, formatMoney, priceDrop, productLabel, refundMissing, returnIsOpen } from '../lib/derive.js'
import { IconSearch } from '../components/Icons.jsx'
import Thumb from '../components/Thumb.jsx'

const FILTERS = ['All', 'Returns', 'Warranties', 'Refunds', 'Price Drops']

export default function Purchases() {
  const { purchases } = usePurchases()
  const [filter, setFilter] = useState('All')
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    let list = purchases
    if (filter === 'Returns') list = list.filter(returnIsOpen)
    if (filter === 'Warranties') list = list.filter((p) => !!p.warrantyExpires)
    if (filter === 'Refunds') list = list.filter(refundMissing)
    if (filter === 'Price Drops') list = list.filter((p) => priceDrop(p) > 0)

    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter(
        (p) =>
          p.product.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.store.toLowerCase().includes(q)
      )
    }
    return list
  }, [purchases, filter, query])

  const totalSpent = purchases.reduce((sum, p) => sum + p.price, 0)

  return (
    <div className="screen">
      <div className="page-header">
        <h1>Purchases</h1>
      </div>

      <section className="summary summary--compact">
        <div className="summary__label">Total spent</div>
        <div className="summary__amount">{formatMoney(totalSpent)}</div>
        <div className="summary__hint">
          Across {purchases.length} purchase{purchases.length === 1 ? '' : 's'}
        </div>
      </section>

      <div className="search-field">
        <IconSearch />
        <input
          type="text"
          placeholder="Search purchases"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="chip-row">
        {FILTERS.map((f) => (
          <button
            key={f}
            className={'chip' + (filter === f ? ' is-active' : '')}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="list">
        {filtered.length === 0 && <p className="empty-note">No purchases match.</p>}
        {filtered.map((p) => (
          <Link to={`/purchases/${p.id}`} key={p.id} className="list-row list-row--simple">
            <Thumb purchase={p} />
            <div className="list-row__main">
              <div className="list-row__title">{productLabel(p)}</div>
              <div className="list-row__line">{p.store}</div>
            </div>
            <div className="list-row__trailing">
              <div className="list-row__price">{formatMoney(p.price)}</div>
              <div className="list-row__line">{formatDate(p.purchaseDate)}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
