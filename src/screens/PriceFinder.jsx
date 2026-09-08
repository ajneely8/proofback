import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePurchases } from '../lib/PurchasesContext.jsx'
import { searchPurchasesForPriceFinder, formatMoney, formatDate, productLabel } from '../lib/derive.js'
import { loadRecentSearches, addRecentSearch, removeRecentSearch, clearRecentSearches } from '../lib/priceFinderHistory.js'
import { IconChevronLeft, IconSearch } from '../components/Icons.jsx'
import Thumb from '../components/Thumb.jsx'

export default function PriceFinder() {
  const navigate = useNavigate()
  const { purchases } = usePurchases()
  const [query, setQuery] = useState('')
  const [recent, setRecent] = useState(loadRecentSearches)
  const [results, setResults] = useState(null) // null = no search run yet this visit

  function runSearch(text) {
    const q = text.trim()
    if (!q) return
    addRecentSearch(q)
    setRecent(loadRecentSearches())
    const matches = searchPurchasesForPriceFinder(q, purchases)
    if (matches.length === 1) {
      navigate(`/price-watch/${matches[0].id}`)
      return
    }
    setResults(matches)
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

  return (
    <div className="screen">
      <button className="back-link" onClick={() => navigate(-1)}>
        <IconChevronLeft />
        Back
      </button>

      <div className="page-header">
        <h1>Price Finder</h1>
        <p className="page-header__sub">
          Search a product you've bought through ProofBack to compare its price. Price Finder only shows pricing
          ProofBack has actually verified — there's no external product catalog connected, so a product you haven't
          purchased won't return a result yet.
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

      {results !== null && (
        <section className="section">
          <div className="section__title">Results</div>
          {results.length === 0 ? (
            <p className="field-hint field-hint--block">
              No verified match in your purchases. Price Finder can only compare prices for products you've actually
              bought through ProofBack.
            </p>
          ) : (
            <>
              {results.length > 1 && <p className="field-hint field-hint--block">Choose the exact product:</p>}
              <div className="list">
                {results.map((p) => (
                  <button
                    key={p.id}
                    className="list-row list-row--simple"
                    onClick={() => navigate(`/price-watch/${p.id}`)}
                  >
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
