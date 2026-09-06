import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWatchlist } from '../lib/WatchlistContext.jsx'
import { formatMoney, formatDate } from '../lib/derive.js'
import { IconChevronLeft, IconTarget, IconPlus } from '../components/Icons.jsx'
import EmptyState from '../components/EmptyState.jsx'

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function Watchlist() {
  const navigate = useNavigate()
  const { items, addItem, updateItem, removeItem } = useWatchlist()
  const [showForm, setShowForm] = useState(false)
  const [product, setProduct] = useState('')
  const [store, setStore] = useState('')
  const [targetPrice, setTargetPrice] = useState('')
  const [seenPrice, setSeenPrice] = useState('')
  const [checkInputs, setCheckInputs] = useState({}) // id -> in-progress "log a price" text

  function handleAdd(e) {
    e.preventDefault()
    if (!product || !targetPrice) return
    addItem({
      id: `w-${Date.now()}`,
      product,
      store: store || null,
      targetPrice: Number(targetPrice),
      lastSeenPrice: seenPrice ? Number(seenPrice) : null,
      lastCheckedDate: seenPrice ? todayISO() : null,
      createdDate: todayISO(),
    })
    setProduct('')
    setStore('')
    setTargetPrice('')
    setSeenPrice('')
    setShowForm(false)
  }

  function logPrice(id) {
    const value = Number(checkInputs[id])
    if (!checkInputs[id] || isNaN(value) || value < 0) return
    updateItem(id, { lastSeenPrice: value, lastCheckedDate: todayISO() })
    setCheckInputs((prev) => ({ ...prev, [id]: '' }))
  }

  return (
    <div className="screen">
      <button className="back-link" onClick={() => navigate(-1)}>
        <IconChevronLeft />
        Back
      </button>

      <div className="page-header">
        <h1>Watchlist</h1>
        <p className="page-header__sub">
          Track a price before you buy. There's no automatic price-checking here — log what you
          see, and it'll flag once your target's hit.
        </p>
      </div>

      {showForm ? (
        <section className="detail-card">
          <form onSubmit={handleAdd}>
            <div className="field-row">
              <label>Item</label>
              <input type="text" value={product} onChange={(e) => setProduct(e.target.value)} autoFocus required />
            </div>
            <div className="field-row">
              <label>Store</label>
              <input type="text" value={store} onChange={(e) => setStore(e.target.value)} />
            </div>
            <div className="field-row">
              <label>Target price</label>
              <div className="field-row__money">
                <span>$</span>
                <input
                  type="number"
                  step="0.01"
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="field-row">
              <label>Price now (optional)</label>
              <div className="field-row__money">
                <span>$</span>
                <input type="number" step="0.01" value={seenPrice} onChange={(e) => setSeenPrice(e.target.value)} />
              </div>
            </div>
            <div className="action-row">
              <button type="button" className="btn btn--secondary" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn--primary">
                Add to Watchlist
              </button>
            </div>
          </form>
        </section>
      ) : (
        <button className="btn btn--primary btn--block" onClick={() => setShowForm(true)}>
          <IconPlus width={18} height={18} />
          Add Item to Watch
        </button>
      )}

      <section className="section">
        {items.length === 0 ? (
          <EmptyState
            icon={IconTarget}
            title="Nothing on your watchlist"
            detail="Add something you're thinking about buying and a target price — you'll see it flagged here once you log a price that hits it."
          />
        ) : (
          <div className="list">
            {items.map((item) => {
              const hit = item.lastSeenPrice != null && item.lastSeenPrice <= item.targetPrice
              return (
                <section className="detail-card" key={item.id}>
                  <div className="detail-card__row">
                    <span className="list-row__title">{item.product}</span>
                  </div>
                  {item.store && (
                    <div className="detail-card__row">
                      <span>Store</span>
                      <strong>{item.store}</strong>
                    </div>
                  )}
                  <div className="detail-card__row">
                    <span>Target price</span>
                    <strong>{formatMoney(item.targetPrice)}</strong>
                  </div>
                  <div className="detail-card__row">
                    <span>Last seen</span>
                    <strong className={hit ? 'text-accent' : ''}>
                      {item.lastSeenPrice != null ? formatMoney(item.lastSeenPrice) : 'Not checked yet'}
                    </strong>
                  </div>
                  {item.lastCheckedDate && (
                    <div className="detail-card__row">
                      <span>Checked</span>
                      <strong>{formatDate(item.lastCheckedDate)}</strong>
                    </div>
                  )}
                  {hit && <p className="field-hint field-hint--good">Target hit — go buy it.</p>}

                  <div className="field-row">
                    <label>Log a price</label>
                    <div className="field-row__money">
                      <span>$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={checkInputs[item.id] || ''}
                        onChange={(e) => setCheckInputs((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="action-row">
                    <button className="btn btn--secondary" onClick={() => removeItem(item.id)}>
                      Remove
                    </button>
                    <button className="btn btn--primary" onClick={() => logPrice(item.id)}>
                      Save
                    </button>
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
