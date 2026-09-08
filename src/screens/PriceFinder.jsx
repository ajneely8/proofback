import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePurchases } from '../lib/PurchasesContext.jsx'
import { useAuth } from '../lib/AuthContext.jsx'
import { searchPurchasesForPriceFinder, formatMoney, formatDate, productLabel } from '../lib/derive.js'
import { loadRecentSearches, addRecentSearch, removeRecentSearch, clearRecentSearches } from '../lib/priceFinderHistory.js'
import { IconChevronLeft, IconSearch } from '../components/Icons.jsx'
import Thumb from '../components/Thumb.jsx'

const LIVE_ERROR_MESSAGES = {
  not_configured: "Live price search isn't set up yet.",
  error: "Couldn't reach the price-search service right now — try again in a moment.",
  no_verified_results: "Unable to verify current prices for this product at major retailers.",
}

export default function PriceFinder() {
  const navigate = useNavigate()
  const { purchases } = usePurchases()
  const { session } = useAuth()
  const [query, setQuery] = useState('')
  const [recent, setRecent] = useState(loadRecentSearches)
  const [ownedResults, setOwnedResults] = useState(null) // null = no search run yet this visit
  const [live, setLive] = useState(null) // { status, matches, checkedAt } | null
  const [liveLoading, setLiveLoading] = useState(false)

  async function runLiveSearch(q) {
    setLiveLoading(true)
    setLive(null)
    try {
      const res = await fetch('/api/price-finder-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ query: q }),
      })
      const data = await res.json()
      setLive(res.ok ? data : { status: 'error', matches: [] })
    } catch {
      setLive({ status: 'error', matches: [] })
    } finally {
      setLiveLoading(false)
    }
  }

  function runSearch(text) {
    const q = text.trim()
    if (!q) return
    addRecentSearch(q)
    setRecent(loadRecentSearches())
    const matches = searchPurchasesForPriceFinder(q, purchases)
    setOwnedResults(matches)
    runLiveSearch(q)
  }

  function handleSubmit(e) {
    e.preventDefault()
    runSearch(query)
  }

  function handleRemove(id) {
    removeRecentSearch(id)
    setRecent(loadRecentSearches())
  }

  function handleClear() {
    clearRecentSearches()
    setRecent([])
  }

  const ownedMatch = ownedResults?.length === 1 ? ownedResults[0] : null
  const liveMatches = live?.status === 'results' ? live.matches : []
  const lowest = liveMatches[0] // already sorted lowest-first server-side
  const highest = liveMatches[liveMatches.length - 1]

  return (
    <div className="screen">
      <button className="back-link" onClick={() => navigate(-1)}>
        <IconChevronLeft />
        Back
      </button>

      <div className="page-header">
        <h1>Price Finder</h1>
        <p className="page-header__sub">
          Search any product to compare real prices at major retailers. Results are limited to listings ProofBack
          can confidently verify as a new, first-party retail price — not marketplace resellers or used items.
        </p>
      </div>

      <form className="search-field" onSubmit={handleSubmit}>
        <IconSearch />
        <input
          type="text"
          placeholder="Search for a product…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </form>

      {(ownedResults !== null || live !== null || liveLoading) && (
        <section className="section">
          {ownedMatch && (
            <div className="detail-card price-finder-owned">
              <div className="detail-card__label">You Purchased This</div>
              <div className="detail-card__row">
                <span>Purchased for</span>
                <strong>{formatMoney(ownedMatch.price)}</strong>
              </div>
              <div className="detail-card__row">
                <span>Store</span>
                <strong>{ownedMatch.store}</strong>
              </div>
              <div className="detail-card__row">
                <span>Purchase date</span>
                <strong>{formatDate(ownedMatch.purchaseDate)}</strong>
              </div>
              <button className="link-action link-action--inline" onClick={() => navigate(`/price-watch/${ownedMatch.id}`)}>
                View Price Watch details
              </button>
            </div>
          )}

          {ownedResults?.length > 1 && (
            <>
              <div className="section__title">Choose Product</div>
              <div className="list" style={{ marginBottom: 16 }}>
                {ownedResults.map((p) => (
                  <button key={p.id} className="list-row list-row--simple" onClick={() => navigate(`/price-watch/${p.id}`)}>
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
                ))}
              </div>
            </>
          )}

          <div className="section__title">Retailer Prices</div>
          {liveLoading ? (
            <p className="field-hint field-hint--block">Checking major retailers…</p>
          ) : live?.status === 'results' ? (
            <>
              {highest && lowest && highest.price > lowest.price && (
                <p className="field-hint field-hint--block" style={{ margin: '0 0 10px' }}>
                  Highest price: {formatMoney(highest.price)} · Lowest price: {formatMoney(lowest.price)} · Potential
                  savings: <strong className="text-accent">{formatMoney(highest.price - lowest.price)}</strong>
                </p>
              )}
              <div className="price-finder-table">
                {liveMatches.map((m, i) => (
                  <a
                    key={i}
                    className={'price-finder-row' + (i === 0 ? ' price-finder-row--lowest' : '')}
                    href={m.link || undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <div className="price-finder-row__store">
                      {m.store}
                      {i === 0 && <span className="price-finder-row__tag">Lowest</span>}
                    </div>
                    <div className="price-finder-row__title">{m.title}</div>
                    <div className="price-finder-row__price">{formatMoney(m.price)}</div>
                  </a>
                ))}
              </div>
              <p className="field-hint field-hint--block" style={{ margin: '10px 0 0' }}>
                Checked {formatDate(live.checkedAt?.slice(0, 10))}. Prices change frequently — tap a store to verify
                before buying.
              </p>
            </>
          ) : (
            <p className="field-hint field-hint--block">{LIVE_ERROR_MESSAGES[live?.status] || 'No results.'}</p>
          )}
        </section>
      )}

      {recent.length > 0 && (
        <section className="section">
          <div className="section__title section__title--row">
            <span>Recent Searches</span>
            <button className="link-action link-action--inline" onClick={handleClear}>
              Clear all
            </button>
          </div>
          <div className="list">
            {recent.map((s) => (
              <div key={s.id} className="recent-search-row">
                <button className="recent-search-row__query" onClick={() => { setQuery(s.query); runSearch(s.query) }}>
                  {s.query}
                </button>
                <button className="recent-search-row__remove" onClick={() => handleRemove(s.id)} aria-label="Remove">
                  ×
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
