import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePurchases } from '../lib/PurchasesContext.jsx'
import { useAuth } from '../lib/AuthContext.jsx'
import { searchPurchasesForPriceFinder, formatMoney, formatDate, productLabel } from '../lib/derive.js'
import { loadRecentSearches, addRecentSearch, removeRecentSearch, clearRecentSearches } from '../lib/priceFinderHistory.js'
import { logoCandidatesFor } from '../lib/logo.js'
import { PRICE_FINDER_SUGGESTIONS } from '../data/priceFinderSuggestions.js'
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

// One row in the ranked price-comparison list: a compact product thumb,
// store name + item title, and the price with either a "CHEAPEST" tag (the
// verified lowest) or a "+$X.XX" difference from it — the layout the spec
// asks for, not a store-grouped card carousel.
function PriceFinderRankRow({ match, rank, isLowest, diffFromLowest, onSelect }) {
  const [photoOk, setPhotoOk] = useState(true)
  const hasDiscount = match.oldPrice && match.oldPrice > match.price

  return (
    <button
      type="button"
      className={'list-row price-finder-rank-row' + (match.isPriorityRetailer ? ' price-finder-rank-row--priority' : '')}
      onClick={onSelect}
    >
      <div className="price-finder-rank-row__num">{rank}</div>
      <div className="thumb thumb--md">
        {photoOk && match.thumbnail ? (
          <img src={match.thumbnail} alt="" onError={() => setPhotoOk(false)} />
        ) : (
          <span className="price-finder-thumb__fallback">{(match.store || '?').charAt(0)}</span>
        )}
      </div>
      <div className="list-row__main">
        <div className="list-row__title">
          {match.store}
          {match.isPriorityRetailer && (
            <span className="price-finder-priority-badge" title="One of your preferred retailers">
              ★
            </span>
          )}
        </div>
        <div className="list-row__line">{match.title}</div>
        {match.membershipRequired && (
          <div className="list-row__line price-finder-membership-note">Membership price</div>
        )}
      </div>
      <div className="list-row__trailing">
        <div className={'list-row__price' + (isLowest ? ' price-finder-price--cheapest' : '')}>
          {formatMoney(match.price)}
        </div>
        {hasDiscount && <div className="price-finder-rank-row__old-price">{formatMoney(match.oldPrice)}</div>}
        {isLowest ? (
          <div className="price-finder-row__tag">Cheapest</div>
        ) : (
          <div className="list-row__line">+{formatMoney(diffFromLowest)}</div>
        )}
      </div>
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
  const [realLink, setRealLink] = useState(null) // the selected match's actual merchant page, once found
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [category, setCategory] = useState('') // '' | 'Shoes' | 'Clothing'
  const [gender, setGender] = useState('')
  const [size, setSize] = useState('')
  const [color, setColor] = useState('')
  const [sortOrder, setSortOrder] = useState('asc') // 'asc' = lowest price first (the default), 'desc' = highest first
  const [freeShippingOnly, setFreeShippingOnly] = useState(false)

  // selected.link is a Google search-results redirect, not the merchant's
  // own product page — the real one costs a separate SerpApi request (see
  // getProductLink in server/priceFinder.js), so it's only looked up once
  // someone actually opens a product's detail sheet, not for every result
  // in a search (which would multiply the 250-search/month quota usage by
  // however many results a search returns). Falls back to the Google link
  // — always clickable — if the lookup fails or is still in flight.
  useEffect(() => {
    if (!selected?.pageToken) {
      setRealLink(null)
      return
    }
    let cancelled = false
    setRealLink(null)
    fetch('/api/price-finder-product-link', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ pageToken: selected.pageToken, store: selected.store }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setRealLink(data.link || null)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [selected])

  // Search-as-you-type help. Past searches and products the user's
  // actually bought come first (most relevant to them specifically), then
  // a static list of real brand/product names fills in the rest — a live
  // suggestion API (e.g. SerpApi's Google Autocomplete) would cost one
  // request per keystroke against the same 250-search/month quota the
  // price search itself uses, so this covers "things people search for in
  // general" for free instead. Within each source, a suggestion starting
  // with what's typed ranks above one that just contains it somewhere,
  // same way real search-suggestion UIs prioritize.
  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const seen = new Set()

    function collect(candidates) {
      const starts = []
      const contains = []
      for (const text of candidates) {
        const key = text.toLowerCase()
        if (key === q || seen.has(key) || !key.includes(q)) continue
        seen.add(key)
        ;(key.startsWith(q) ? starts : contains).push(text)
      }
      return [...starts, ...contains]
    }

    const fromRecent = collect(recent.map((r) => r.query))
    const fromPurchases = collect(purchases.map(productLabel))
    const fromStatic = collect(PRICE_FINDER_SUGGESTIONS)
    return [...fromRecent, ...fromPurchases, ...fromStatic].slice(0, 8)
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

  // Folds gender/size/color into the query text itself (e.g. "Nike Air
  // Force 1 Men's size 10.5 black") rather than a separate filter request —
  // testing confirmed real retailers' titles do carry these (Google
  // Shopping's own facet panel offers Men's/Women's/Kids' for exactly this
  // reason), so this gets genuinely more specific real matches without a
  // second API call (a live facets round-trip would cost more of the
  // 250-search/month quota per refinement).
  function buildEffectiveQuery(base) {
    const parts = [base.trim()]
    // Only adds "Shoes"/"Clothing" when the search doesn't already name a
    // specific item (e.g. skip it for "Nike hoodie" — "hoodie" already
    // says enough) — otherwise a bare brand/style search like "Jordan"
    // stays ambiguous between the sneakers and the apparel line.
    if (category && !base.toLowerCase().includes(category.toLowerCase())) parts.push(category)
    if (gender) parts.push(gender)
    if (size.trim()) parts.push(`size ${size.trim()}`)
    if (color.trim()) parts.push(color.trim())
    return parts.filter(Boolean).join(' ')
  }

  function runSearch(text) {
    const q = text.trim()
    if (!q) return
    addRecentSearch(q)
    setRecent(loadRecentSearches())
    const matches = searchPurchasesForPriceFinder(q, purchases)
    setOwnedResults(matches)
    // A new search always starts cheapest-first — without this, toggling
    // "Highest price" once would leave every later search looking
    // unsorted (it'd silently carry the old sort/filter into results the
    // user hasn't seen yet).
    setSortOrder('asc')
    setFreeShippingOnly(false)
    runLiveSearch(q)
  }

  function handleSubmit(e) {
    e.preventDefault()
    setSuggestionsOpen(false)
    runSearch(buildEffectiveQuery(query))
  }

  function handleSuggestionSelect(text) {
    setQuery(text)
    setSuggestionsOpen(false)
    runSearch(buildEffectiveQuery(text))
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

  // Display order only — "cheapest"/the $ difference badges always compare
  // against `lowest` above, regardless of which way the list is sorted.
  const rankedMatches = useMemo(() => {
    const arr = [...liveMatches]
    if (sortOrder === 'desc') arr.reverse()
    return freeShippingOnly ? arr.filter((m) => m.delivery && /free/i.test(m.delivery)) : arr
  }, [liveMatches, sortOrder, freeShippingOnly])

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
        <form onSubmit={handleSubmit}>
          <div className="search-field">
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
          </div>
          <div className="price-finder-refine">
            <select
              className="price-finder-refine__field"
              value={category}
              onChange={(e) => {
                const next = e.target.value
                setCategory(next)
                // Gender/size/color only mean something once a category is
                // picked — clear them instead of leaving stale values that
                // no longer show on screen but would still fold into the
                // next search.
                if (!next) {
                  setGender('')
                  setSize('')
                  setColor('')
                }
              }}
              aria-label="Category"
            >
              <option value="">Shoes or clothing?</option>
              <option value="Shoes">Shoes</option>
              <option value="Clothing">Clothing</option>
            </select>
            {category && (
              <>
                <select
                  className="price-finder-refine__field"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  aria-label="Gender"
                >
                  <option value="">Men's / Women's / Kids'</option>
                  <option value="Men's">Men's</option>
                  <option value="Women's">Women's</option>
                  <option value="Kids'">Kids'</option>
                </select>
                <input
                  type="text"
                  className="price-finder-refine__field"
                  placeholder={category === 'Shoes' ? 'Size (e.g. 10.5)' : 'Size (e.g. M, 32x34)'}
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                />
                <input
                  type="text"
                  className="price-finder-refine__field"
                  placeholder="Color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                />
              </>
            )}
          </div>
          <button type="submit" className="btn btn--primary btn--block">
            <IconSearch width={16} height={16} />
            Search
          </button>
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

          <div className="section__title">Price Comparison</div>
          <p className="field-hint field-hint--block" style={{ margin: '0 0 10px' }}>
            Only major, verified retailers — not marketplace resellers, auction sites, or small/unverified stores.
          </p>
          {liveLoading ? (
            <p className="field-hint field-hint--block">Checking major retailers…</p>
          ) : live?.status === 'results' ? (
            <>
              <div className="price-finder-summary">
                <div className="price-finder-summary__block price-finder-summary__block--cheapest">
                  <div className="price-finder-summary__label">Cheapest</div>
                  <div className="price-finder-summary__amount">{formatMoney(lowest.price)}</div>
                  <div className="price-finder-summary__store">{lowest.store}</div>
                </div>
                {highest && highest.price > lowest.price && (
                  <>
                    <div className="price-finder-summary__block">
                      <div className="price-finder-summary__label">Most expensive</div>
                      <div className="price-finder-summary__amount">{formatMoney(highest.price)}</div>
                      <div className="price-finder-summary__store">{highest.store}</div>
                    </div>
                    <div className="price-finder-summary__block price-finder-summary__block--savings">
                      <div className="price-finder-summary__label">Potential savings</div>
                      <div className="price-finder-summary__amount">{formatMoney(highest.price - lowest.price)}</div>
                    </div>
                  </>
                )}
              </div>

              <div className="price-finder-controls">
                <div className="chip-row" style={{ marginBottom: 0 }}>
                  <button className={'chip' + (sortOrder === 'asc' ? ' is-active' : '')} onClick={() => setSortOrder('asc')}>
                    Lowest price
                  </button>
                  <button className={'chip' + (sortOrder === 'desc' ? ' is-active' : '')} onClick={() => setSortOrder('desc')}>
                    Highest price
                  </button>
                  <button
                    className={'chip' + (freeShippingOnly ? ' is-active' : '')}
                    onClick={() => setFreeShippingOnly((v) => !v)}
                  >
                    Free shipping
                  </button>
                </div>
              </div>

              <div className="list">
                {rankedMatches.map((m, i) => (
                  <PriceFinderRankRow
                    key={i}
                    match={m}
                    rank={i + 1}
                    isLowest={m === lowest}
                    diffFromLowest={m.price - lowest.price}
                    onSelect={() => setSelected(m)}
                  />
                ))}
              </div>
              {rankedMatches.length === 0 && (
                <p className="field-hint field-hint--block">No results have free shipping listed.</p>
              )}

              <p className="field-hint field-hint--block" style={{ margin: '10px 0 0' }}>
                Price checked {new Date(live.checkedAt).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}. Prices change frequently — tap a product for details, or confirm on the store's site before
                buying.
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
                <span>Shipping</span>
                <strong>{selected.delivery}</strong>
              </div>
            )}
            <div className="detail-card__row">
              <span>Pickup</span>
              <strong>Not verified — check the store</strong>
            </div>
            <div className="detail-card__row">
              <span>Availability</span>
              <strong>Not verified — check the store</strong>
            </div>
            {selected.membershipRequired && (
              <div className="detail-card__row">
                <span>Price requires</span>
                <strong>{selected.store} membership</strong>
              </div>
            )}
            {live?.checkedAt && (
              <div className="detail-card__row">
                <span>Price checked</span>
                <strong>
                  {new Date(live.checkedAt).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </strong>
              </div>
            )}
            {selected.snippet && <p className="field-hint field-hint--block">{selected.snippet}</p>}
            {(realLink || selected.link) && (
              <a
                className="btn btn--primary btn--block"
                href={realLink || selected.link}
                target="_blank"
                rel="noopener noreferrer"
              >
                View at {selected.store}
              </a>
            )}
            {!realLink && selected.pageToken && (
              <p className="field-hint field-hint--block" style={{ textAlign: 'center', marginTop: 6 }}>
                Finding the direct product page…
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
