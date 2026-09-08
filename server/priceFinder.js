/**
 * Real product-price search for Price Finder, via SerpApi's Google Shopping
 * engine — shared between server/index.js (Express, local dev) and
 * api/price-finder-search.js (Vercel serverless function), same split as
 * server/scanReceipt.js and server/checkRecall.js.
 *
 * Google Shopping's raw results are NOT limited to major retailers — a live
 * test query returned eBay, Poshmark, and third-party marketplace sellers
 * (e.g. "Walmart - TheRightOne") mixed in with genuine Walmart/Best Buy/etc.
 * listings, plus a used unit with no price-comparable new one. So the real
 * work here isn't calling the API, it's filtering its output down to
 * listings this app can actually stand behind: a known major retailer,
 * selling new (not used/refurbished), with a real extracted price. Anything
 * that doesn't clear that bar is left out rather than shown as if it were
 * comparable — never invent a retailer price, and never let two different
 * products/conditions masquerade as the same comparison.
 */

const SERPAPI_URL = 'https://serpapi.com/search.json'
const MAX_MATCHES = 12

// Normalized major-retailer names this app will actually show a price
// for — matched case-insensitively against SerpApi's `source` field. Keys
// are the lowercased forms `source` commonly takes; values are the clean
// display name. A `source` with anything appended after it (e.g.
// "Walmart - TheRightOne", a marketplace seller, not Walmart itself) is
// rejected by the exact-match check below, not fuzzy-matched in.
const RETAILER_ALLOWLIST = {
  walmart: 'Walmart',
  target: 'Target',
  amazon: 'Amazon',
  'amazon.com': 'Amazon',
  'best buy': 'Best Buy',
  bestbuy: 'Best Buy',
  'home depot': 'Home Depot',
  'the home depot': 'Home Depot',
  "lowe's": "Lowe's",
  lowes: "Lowe's",
  costco: 'Costco',
  "sam's club": "Sam's Club",
  'sams club': "Sam's Club",
  walgreens: 'Walgreens',
  cvs: 'CVS',
  "kohl's": "Kohl's",
  kohls: "Kohl's",
  "macy's": "Macy's",
  macys: "Macy's",
  "dick's sporting goods": "Dick's Sporting Goods",
  'dicks sporting goods': "Dick's Sporting Goods",
  nike: 'Nike',
  apple: 'Apple',
  wayfair: 'Wayfair',
  ikea: 'IKEA',
  gap: 'Gap',
  "kohl's.com": "Kohl's",
}

function isConfigured() {
  return !!process.env.SERPAPI_API_KEY
}

/**
 * query: free-text product search (brand + product works best, e.g.
 * "Apple AirPods Pro 2"). Returns { status: 'results' | 'no_verified_results'
 * | 'error' | 'not_configured', query, matches: [...], checkedAt }. Never
 * throws.
 */
export async function searchProductPrices(query) {
  const term = (query || '').trim()
  const checkedAt = new Date().toISOString()
  if (!isConfigured()) return { status: 'not_configured', query: term, matches: [], checkedAt }
  if (!term) return { status: 'no_verified_results', query: term, matches: [], checkedAt }

  try {
    const url = `${SERPAPI_URL}?engine=google_shopping&q=${encodeURIComponent(term)}&api_key=${process.env.SERPAPI_API_KEY}`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return { status: 'error', query: term, matches: [], checkedAt }

    const data = await res.json()
    const results = Array.isArray(data.shopping_results) ? data.shopping_results : []

    const matches = results
      .filter((r) => {
        if (r.second_hand_condition) return false // used/refurbished — a different product
        if (typeof r.extracted_price !== 'number') return false // no verifiable price
        const sourceKey = (r.source || '').trim().toLowerCase()
        return Object.prototype.hasOwnProperty.call(RETAILER_ALLOWLIST, sourceKey)
      })
      .map((r) => ({
        store: RETAILER_ALLOWLIST[r.source.trim().toLowerCase()],
        title: r.title,
        price: r.extracted_price,
        oldPrice: typeof r.extracted_old_price === 'number' ? r.extracted_old_price : null,
        link: r.product_link || null,
        rating: typeof r.rating === 'number' ? r.rating : null,
        reviews: typeof r.reviews === 'number' ? r.reviews : null,
        thumbnail: r.thumbnail || null,
        sourceIcon: r.source_icon || null,
        delivery: r.delivery || null,
        snippet: r.snippet || null,
        // SerpApi's shopping results don't reliably carry an explicit
        // in-stock flag or quantity — no retailer publishes exact stock
        // counts through Google Shopping (or anywhere else scrapeable), so
        // this is never shown rather than guessed or invented.
      }))
      .sort((a, b) => a.price - b.price)
      .slice(0, MAX_MATCHES)

    if (!matches.length) return { status: 'no_verified_results', query: term, matches: [], checkedAt }
    return { status: 'results', query: term, matches, checkedAt }
  } catch {
    // Network error, timeout, or an unparseable response — fail quietly,
    // same as checkRecall.js.
    return { status: 'error', query: term, matches: [], checkedAt }
  }
}
