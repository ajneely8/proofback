import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePurchases } from '../lib/PurchasesContext.jsx'
import { useAuth } from '../lib/AuthContext.jsx'
import { searchPurchasesForPriceFinder, formatMoney, formatDate, productLabel } from '../lib/derive.js'
import { loadRecentSearches, addRecentSearch, removeRecentSearch, clearRecentSearches } from '../lib/priceFinderHistory.js'
import { logoCandidatesFor } from '../lib/logo.js'
import { IconChevronLeft, IconSearch } from '../components/Icons.jsx'
import Thumb from '../components/Thumb.jsx'

const LIVE_ERROR_MESSAGES = {
  not_configured: "Live price search isn't set up yet.",
  error: "Couldn't reach the price-search service right now — try again in a moment.",
  no_verified_results: "Unable to verify current prices for this product at major retailers.",
}

// The retailer's real logo, guessed from its domain (Google favicon, then
// Clearbit) — the same approach Thumb.jsx uses for a saved purchase's
// store. Deliberately NOT SerpApi's source_icon: that field turned out to
// be a generic Google Shopping merchant badge (the same plain price-tag
// glyph for every "Best Buy" result), not the retailer's actual logo.
function StoreLogo({ match, className }) {
  const candidates = useMemo(() => logoCandidatesFor(match.store), [match.store])
  const [index, setIndex] = useState(0)

  if (index >= candidates.length) return null
  return <img className={className} src={candidates[index]} alt="" onError={() => setIndex((i) => i + 1)} />
}

// A single retailer result, styled like a Google Shopping result card:
// product photo up top (with a "Sale" badge when there's a real discount),
// title, price with the old price struck through, store, and rating —
// scrolls horizontally alongside the other matches instead of stacking in
// a vertical list.
function PriceFinderCard({ match, isLowest, onSelect }) {
  const [photoOk, setPhotoOk] = useState(true)
  const hasDiscount = match.oldPrice && match.oldPrice > match.price

  return (
    <button
      type="button"
      className={'price-finder-card' + (isLowest ? ' price-finder-card--lowest' : '')}
      onClick={onSelect}
    >
      <div className="price-finder-card__image">
        {hasDiscount && <span className="price-finder-card__badge">Sale</span>}
        {photoOk && match.thumbnail ? (
          <img src={match.thumbnail} alt="" onError={() => setPhotoOk(false)} />
        ) : (
          <span className="price-finder-thumb__fallback">{(match.store || '?').charAt(0)}</span>
        )}
      </div>
      <div className="price-finder-card__title">{match.title}</div>
      <div className="price-finder-card__price-row">
        <span className="price-finder-card__price">{formatMoney(match.price)}</span>
        {hasDiscount && <span className="price-finder-card__old-price">{formatMoney(match.oldPrice)}</span>}
      </div>
      <div className="price-finder-card__store">
        <StoreLogo match={match} className="price-finder-card__store-logo" />
        <span>{match.store}</span>
        {isLowest && <span className="price-finder-row__tag"> · Lowest</span>}
      </div>
      {typeof match.rating === 'number' && (
        <div className="price-finder-card__rating">
          ★ {match.rating}
          {match.reviews ? ` (${match.reviews.toLocaleString()})` : ''}
        </div>
      )}
    </button>
  )
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
  const [selected, setSelected] = useState(null) // the tapped match, or null
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)

  // Search-as-you-type help, built entirely from the user's own real data
  // (no extra API call per keystroke, which would burn through SerpApi's
  // free-tier quota fast) — past searches first, then products they've
  // actually bought, so finishing a query someone's already typed the start
  // of is usually just a tap away.
  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const seen = new Set()
    const fromRecent = []
    for (const r of recent) {
      const key = r.query.toLowerCase()
      if (key === q || seen.has(key) || !key.includes(q)) continue
      seen.add(key)
      fromRecent.push(r.query)
    }
    const fromPurchases = []
    for (const p of purchases) {
      const label = productLabel(p)
      const key = label.toLowerCase()
      if (key === q || seen.has(key) || !key.includes(q)) continue
      seen.add(key)
      fromPurchases.push(label)
    }
    return [...fromRecent, ...fromPurchases].slice(0, 6)
  }, [query, recent, purchases])

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
    setSuggestionsOpen(false)
    runSearch(query)
  }

  function handleSuggestionSelect(text) {
    setQuery(text)
    setSuggestionsOpen(false)
    runSearch(text)
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

      <div className="price-finder-search-wrap">
        <form className="search-field" onSubmit={handleSubmit}>
          <IconSearch />
          <input
            type="text"
            placeholder="Search for a product…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSuggestionsOpen(true)
            }}
            onFocus={() => setSuggestionsOpen(true)}
            onBlur={() => setTimeout(() => setSuggestionsOpen(false), 120)}
          />
        </form>
        {suggestionsOpen && suggestions.length > 0 && (
          <div className="price-finder-suggestions">
            {suggestions.map((text) => (
              <button
                key={text}
                type="button"
                className="price-finder-suggestions__item"
                // onMouseDown (not onClick) fires before the input's onBlur,
                // so the suggestion is still in the DOM to be clicked.
                onMouseDown={(e) => {
                  e.preventDefault()
                  handleSuggestionSelect(text)
                }}
              >
                <IconSearch width={14} height={14} />
                <span>{text}</span>
              </button>
            ))}
          </div>
        )}
      </div>

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
          <p className="field-hint field-hint--block" style={{ margin: '0 0 10px' }}>
            Showing major retailers ProofBack could verify — not every store carrying this product.
          </p>
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
              <div className="price-finder-carousel">
                {liveMatches.map((m, i) => (
                  <PriceFinderCard key={i} match={m} isLowest={i === 0} onSelect={() => setSelected(m)} />
                ))}
              </div>
              <p className="field-hint field-hint--block" style={{ margin: '10px 0 0' }}>
                Checked {formatDate(live.checkedAt?.slice(0, 10))}. Prices change frequently — tap a product for
                details, or confirm on the store's site before buying.
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

      {selected && (
        <div className="price-finder-sheet-backdrop" onClick={() => setSelected(null)}>
          <div className="price-finder-sheet" onClick={(e) => e.stopPropagation()}>
            <button className="price-finder-sheet__close" onClick={() => setSelected(null)} aria-label="Close">
              ×
            </button>
            <div className="price-finder-sheet__image">
              {selected.thumbnail ? (
                <img src={selected.thumbnail} alt="" />
              ) : (
                <span className="price-finder-thumb__fallback">{(selected.store || '?').charAt(0)}</span>
              )}
            </div>
            <div className="price-finder-sheet__store">
              <StoreLogo match={selected} className="price-finder-sheet__store-logo" />
              <span>{selected.store}</span>
            </div>
            <div className="price-finder-sheet__title">{selected.title}</div>
            <div className="price-finder-sheet__price-row">
              <span className="price-finder-sheet__price">{formatMoney(selected.price)}</span>
              {selected.oldPrice && selected.oldPrice > selected.price && (
                <span className="price-finder-sheet__old-price">{formatMoney(selected.oldPrice)}</span>
              )}
            </div>
            {typeof selected.rating === 'number' && (
              <div className="detail-card__row">
                <span>Rating</span>
                <strong>
                  {selected.rating} / 5{selected.reviews ? ` (${selected.reviews.toLocaleString()} reviews)` : ''}
                </strong>
              </div>
            )}
            {selected.delivery && (
              <div className="detail-card__row">
                <span>Delivery</span>
                <strong>{selected.delivery}</strong>
              </div>
            )}
            <div className="detail-card__row">
              <span>Availability</span>
              <strong>Not verified — check the store</strong>
            </div>
            {selected.snippet && <p className="field-hint field-hint--block">{selected.snippet}</p>}
            {selected.link && (
              <a className="btn btn--primary btn--block" href={selected.link} target="_blank" rel="noopener noreferrer">
                View at {selected.store}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
