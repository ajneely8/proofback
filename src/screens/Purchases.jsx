import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { usePurchases } from '../lib/PurchasesContext.jsx'
import { useSettings } from '../lib/SettingsContext.jsx'
import {
  formatDate,
  formatMoney,
  productLabel,
  refundMissing,
  returnIsOpen,
  getPurchaseStatuses,
  getRecoveryCases,
  getWarrantyState,
  getReceiptHealth,
  groupByReceipt,
  parseSearchQuery,
  applySearchFilter,
} from '../lib/derive.js'
import { IconSearch, IconList, IconCheck } from '../components/Icons.jsx'
import Thumb from '../components/Thumb.jsx'
import EmptyState from '../components/EmptyState.jsx'

const FILTERS = [
  'All',
  'Recovery Cases',
  'Returns',
  'Refunds',
  'Active',
  'Expiring Soon',
  'Expired',
  'Not Confirmed',
  'No Warranty Expected',
]

function StatusDot({ purchase, settings }) {
  const health = getReceiptHealth(purchase, settings)
  return <span className={`status-dot status-dot--${health.status}`} title={health.message} />
}

const WARRANTY_FILTER_STATES = {
  Active: 'active',
  'Expiring Soon': 'expiring_soon',
  Expired: 'expired',
  'Not Confirmed': 'not_confirmed',
  'No Warranty Expected': 'none',
}

export default function Purchases() {
  const { purchases, deletePurchases } = usePurchases()
  const { settings } = useSettings()
  const [searchParams] = useSearchParams()
  const [filter, setFilter] = useState(() => {
    const fromUrl = searchParams.get('filter')
    return FILTERS.includes(fromUrl) ? fromUrl : 'All'
  })
  const [query, setQuery] = useState('')
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState(new Set())

  const smartSearch = useMemo(() => {
    if (!query.trim()) return null
    return parseSearchQuery(query, purchases)
  }, [query, purchases])

  const filtered = useMemo(() => {
    let list = purchases
    if (filter === 'Recovery Cases') {
      const openCaseIds = new Set(
        getRecoveryCases(purchases, settings)
          .filter((c) => c.status !== 'closed')
          .map((c) => c.purchase.id)
      )
      list = list.filter((p) => openCaseIds.has(p.id))
    }
    if (filter === 'Returns') list = list.filter(returnIsOpen)
    if (filter === 'Refunds') list = list.filter(refundMissing)
    if (WARRANTY_FILTER_STATES[filter]) {
      list = list.filter((p) => getWarrantyState(p, settings) === WARRANTY_FILTER_STATES[filter])
    }

    if (query.trim()) {
      const q = query.trim().toLowerCase()
      const plainMatches = list.filter((p) => {
        const statusText = getPurchaseStatuses(p, settings).map((s) => s.label.toLowerCase()).join(' ')
        const fields = [
          p.product,
          p.brand,
          p.store,
          p.category,
          p.receiptNumber,
          p.orderNumber,
          p.serialNumber,
          p.notes,
          p.purchaseDate,
          p.returnDeadline,
          p.warrantyExpires,
          p.price != null ? String(p.price) : null,
          statusText,
        ]
        return fields.some((f) => f && String(f).toLowerCase().includes(q))
      })
      // "Find My Purchase": a natural-language-ish query ("show me
      // everything I bought at Walmart", "this year", "still returnable")
      // often matches nothing with a plain substring search — fall back to
      // the parsed structured filter in that case rather than showing
      // "no purchases match" for something the user's own data can answer.
      // Only worth falling back to when the parse actually recognized
      // something — an all-null filter (a query with no store/category/
      // date/keyword signal at all) would otherwise match every purchase,
      // turning "no results" into "show everything" for a typo'd search.
      const smartSearchActive =
        smartSearch &&
        (smartSearch.store || smartSearch.category || smartSearch.dateFrom || smartSearch.dateTo || smartSearch.returnOpenOnly || smartSearch.keyword)
      list = plainMatches.length > 0 || !smartSearchActive ? plainMatches : applySearchFilter(list, smartSearch)
    }
    return list
  }, [purchases, filter, query, settings, smartSearch])

  const searchSumLine =
    query.trim() && smartSearch?.sumMode
      ? `You spent ${formatMoney(filtered.reduce((sum, p) => sum + (Number(p.price) || 0), 0))}${
          smartSearch.category ? ` on ${smartSearch.category}` : ''
        }${smartSearch.store ? ` at ${smartSearch.store}` : ''}${
          smartSearch.dateFrom?.slice(5) === '01-01' ? ` this year` : ''
        }.`
      : null

  const totalSpent = purchases.reduce((sum, p) => sum + p.price, 0)

  // Combine same-receipt items into one row, but only on the plain,
  // unfiltered/unsearched list — every other filter (warranty states,
  // "Returns", a search term) is inherently about which individual items
  // match, and grouping would hide items that don't all share the same
  // answer. Selection mode also stays per-item since bulk delete acts on
  // individual purchase ids.
  const shouldGroup = filter === 'All' && !query.trim() && !selectMode
  const groups = shouldGroup ? groupByReceipt(filtered) : null

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
          <Link to="/products" className="page-header__action">
            What I Own
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

      {searchSumLine && <p className="search-sum">{searchSumLine}</p>}

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
        {shouldGroup
          ? groups.map((g) =>
              g.itemCount === 1 ? (
                <Link to={`/purchases/${g.purchases[0].id}`} key={g.key} className="list-row list-row--simple">
                  <Thumb purchase={g.purchases[0]} />
                  <div className="list-row__main">
                    <div className="list-row__title">
                      <StatusDot purchase={g.purchases[0]} settings={settings} />
                      {productLabel(g.purchases[0])}
                    </div>
                    <div className="list-row__line">{g.purchases[0].store}</div>
                  </div>
                  <div className="list-row__trailing">
                    <div className="list-row__price">{formatMoney(g.purchases[0].price)}</div>
                    <div className="list-row__line">{formatDate(g.purchases[0].purchaseDate)}</div>
                  </div>
                </Link>
              ) : (
                <Link to={`/receipt/${encodeURIComponent(g.key)}`} key={g.key} className="list-row list-row--simple">
                  <Thumb purchase={g.purchases[0]} />
                  <div className="list-row__main">
                    <div className="list-row__title">{g.store} — {g.itemCount} items</div>
                    <div className="list-row__line">{formatDate(g.purchaseDate)}</div>
                  </div>
                  <div className="list-row__trailing">
                    <div className="list-row__price">{formatMoney(g.totalPrice)}</div>
                  </div>
                </Link>
              )
            )
          : filtered.map((p) =>
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
                    <div className="list-row__title">
                      <StatusDot purchase={p} settings={settings} />
                      {productLabel(p)}
                    </div>
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
