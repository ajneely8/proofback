import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePurchases } from '../lib/PurchasesContext.jsx'
import { useSettings } from '../lib/SettingsContext.jsx'
import { formatDate, formatMoney, priceDrop, productLabel, refundMissing, returnIsOpen, getPurchaseStatuses } from '../lib/derive.js'
import { IconSearch, IconList, IconCheck } from '../components/Icons.jsx'
import Thumb from '../components/Thumb.jsx'
import EmptyState from '../components/EmptyState.jsx'

const FILTERS = ['All', 'Returns', 'Warranties', 'Refunds', 'Price Drops']

export default function Purchases() {
  const { purchases, deletePurchases } = usePurchases()
  const { settings } = useSettings()
  const [filter, setFilter] = useState('All')
  const [query, setQuery] = useState('')
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState(new Set())

  const filtered = useMemo(() => {
    let list = purchases
    if (filter === 'Returns') list = list.filter(returnIsOpen)
    if (filter === 'Warranties') list = list.filter((p) => !!p.warrantyExpires)
    if (filter === 'Refunds') list = list.filter(refundMissing)
    if (filter === 'Price Drops') list = list.filter((p) => priceDrop(p) > 0)

    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter((p) => {
        const statusText = getPurchaseStatuses(p, settings).map((s) => s.label.toLowerCase()).join(' ')
        const fields = [
          p.product,
          p.brand,
          p.store,
          p.category,
          p.receiptNumber,
          p.orderNumber,
          p.serialNumber,
          p.purchaseDate,
          p.returnDeadline,
          p.warrantyExpires,
          p.price != null ? String(p.price) : null,
          statusText,
        ]
        return fields.some((f) => f && String(f).toLowerCase().includes(q))
      })
    }
    return list
  }, [purchases, filter, query, settings])

  const totalSpent = purchases.reduce((sum, p) => sum + p.price, 0)

  function toggleSelectMode() {
    setSelectMode((on) => !on)
    setSelected(new Set())
  }

  function toggleSelected(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleDeleteSelected() {
    if (!window.confirm(`Delete ${selected.size} purchase${selected.size === 1 ? '' : 's'}? This can't be undone.`)) {
      return
    }
    deletePurchases([...selected])
    setSelected(new Set())
    setSelectMode(false)
  }

  return (
    <div className="screen">
      <div className="page-header page-header--row">
        <h1>Purchases</h1>
        <div className="page-header__actions">
          {purchases.length > 0 && (
            <button className="page-header__action" onClick={toggleSelectMode}>
              {selectMode ? 'Cancel' : 'Select'}
            </button>
          )}
          <Link to="/watchlist" className="page-header__action">
            Watchlist
          </Link>
          <Link to="/insights" className="page-header__action">
            Insights
          </Link>
        </div>
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
          placeholder="Search product, store, receipt, order #, serial #…"
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
        {filtered.length === 0 && (
          <EmptyState
            icon={IconList}
            title="No purchases match"
            detail="Try a different filter or search term."
          />
        )}
        {filtered.map((p) =>
          selectMode ? (
            <button
              key={p.id}
              className={'list-row list-row--simple' + (selected.has(p.id) ? ' is-selected' : '')}
              onClick={() => toggleSelected(p.id)}
            >
              <div className={'select-check' + (selected.has(p.id) ? ' is-checked' : '')}>
                {selected.has(p.id) && <IconCheck width={12} height={12} />}
              </div>
              <Thumb purchase={p} />
              <div className="list-row__main">
                <div className="list-row__title">{productLabel(p)}</div>
                <div className="list-row__line">{p.store}</div>
              </div>
              <div className="list-row__trailing">
                <div className="list-row__price">{formatMoney(p.price)}</div>
                <div className="list-row__line">{formatDate(p.purchaseDate)}</div>
              </div>
            </button>
          ) : (
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
          )
        )}
      </div>

      {selectMode && selected.size > 0 && (
        <div className="bulk-bar">
          <span>{selected.size} selected</span>
          <button className="btn btn--primary" onClick={handleDeleteSelected} style={{ background: 'var(--accent-warn)' }}>
            Delete
          </button>
        </div>
      )}
    </div>
  )
}
