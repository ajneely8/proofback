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
const MAX_MATCHES = 20

// Normalized major-retailer and brand-direct-store names this app will
// actually show a price for — matched case-insensitively against SerpApi's
// `source` field. Keys are the lowercased forms `source` commonly takes;
// values are the clean display name. A `source` with anything appended
// after it (e.g. "Walmart - TheRightOne", a marketplace seller, not Walmart
// itself) is rejected by the exact-match check below, not fuzzy-matched in
// — except the explicit "<brand> Official" pattern handled separately by
// resolveStore(), since that specific suffix is Google Shopping's own
// signal for a manufacturer's first-party store, not a marketplace seller.
// This list was built from real query results across several product
// categories (electronics, apparel, appliances, home goods) — expand it
// with more names as real searches turn up other legitimate retailers.
const RETAILER_ALLOWLIST = {
  // General / big-box
  walmart: 'Walmart',
  target: 'Target',
  amazon: 'Amazon',
  'amazon.com': 'Amazon',
  'best buy': 'Best Buy',
  bestbuy: 'Best Buy',
  costco: 'Costco',
  "sam's club": "Sam's Club",
  'sams club': "Sam's Club",
  kohls: "Kohl's",
  "kohl's": "Kohl's",
  "kohl's.com": "Kohl's",
  macys: "Macy's",
  "macy's": "Macy's",
  nordstrom: 'Nordstrom',
  'nordstrom rack': 'Nordstrom Rack',
  qvc: 'QVC',
  hsn: 'HSN',
  gap: 'Gap',
  walgreens: 'Walgreens',
  cvs: 'CVS',
  'rite aid': 'Rite Aid',
  // Home improvement / home goods
  'home depot': 'Home Depot',
  'the home depot': 'Home Depot',
  lowes: "Lowe's",
  "lowe's": "Lowe's",
  wayfair: 'Wayfair',
  ikea: 'IKEA',
  'bed bath & beyond': 'Bed Bath & Beyond',
  'crate & barrel': 'Crate & Barrel',
  'pottery barn': 'Pottery Barn',
  'west elm': 'West Elm',
  'williams-sonoma': 'Williams-Sonoma',
  'williams sonoma': 'Williams-Sonoma',
  'ace hardware': 'Ace Hardware',
  menards: 'Menards',
  // Electronics
  newegg: 'Newegg',
  'newegg.com': 'Newegg',
  "b&h photo-video-audio": 'B&H Photo Video',
  'b&h photo video': 'B&H Photo Video',
  'p.c. richard & son': 'P.C. Richard & Son',
  'pc richard & son': 'P.C. Richard & Son',
  'pc richard': 'P.C. Richard & Son',
  'abc warehouse': 'ABC Warehouse',
  gamestop: 'GameStop',
  // Sporting goods / shoes / apparel
  "dick's sporting goods": "Dick's Sporting Goods",
  'dicks sporting goods': "Dick's Sporting Goods",
  "academy sports + outdoors": 'Academy Sports + Outdoors',
  'finish line': 'Finish Line',
  'foot locker': 'Foot Locker',
  'champs sports': 'Champs Sports',
  'jd sports': 'JD Sports',
  'shoe palace': 'Shoe Palace',
  'snipes usa': 'SNIPES',
  snipes: 'SNIPES',
  dsw: 'DSW',
  zappos: 'Zappos',
  nike: 'Nike',
  'nike.com': 'Nike',
  adidas: 'Adidas',
  'adidas.com': 'Adidas',
  'under armour': 'Under Armour',
  // Beauty / pets / hobby
  ulta: 'Ulta Beauty',
  sephora: 'Sephora',
  'sally beauty': 'Sally Beauty',
  'chewy.com': 'Chewy',
  chewy: 'Chewy',
  petco: 'Petco',
  petsmart: 'PetSmart',
  michaels: "Michaels",
  'jo-ann': "JOANN",
  joann: 'JOANN',
  'hobby lobby': 'Hobby Lobby',
  'bass pro shops': 'Bass Pro Shops',
  "cabela's": "Cabela's",
  rei: 'REI',
  // Office / books
  staples: 'Staples',
  'office depot': 'Office Depot',
  officemax: 'OfficeMax',
  "barnes & noble": 'Barnes & Noble',
  // Brand-direct stores commonly seen as their own "source" in Google
  // Shopping without an "Official" suffix
  apple: 'Apple',
  samsung: 'Samsung',
  sony: 'Sony',
  lg: 'LG',
  bose: 'Bose',
  microsoft: 'Microsoft',
  google: 'Google Store',
  hp: 'HP',
  dell: 'Dell',
  lenovo: 'Lenovo',
  logitech: 'Logitech',
  gopro: 'GoPro',
  garmin: 'Garmin',
  fitbit: 'Fitbit',
  nintendo: 'Nintendo',
  kitchenaid: 'KitchenAid',
  dyson: 'Dyson',
  vans: 'Vans',
  crocs: 'Crocs',
  'new balance': 'New Balance',
  skechers: 'Skechers',
}

// Google Shopping tags a manufacturer's own first-party storefront with a
// literal "<Brand> Official" source (confirmed live for "Dyson Official") —
// a real, specific signal distinct from a marketplace-seller suffix like
// "Walmart - TheRightOne", so it's trusted even for brands not individually
// hand-listed above.
function resolveStore(rawSource) {
  const source = (rawSource || '').trim()
  const key = source.toLowerCase()
  if (Object.prototype.hasOwnProperty.call(RETAILER_ALLOWLIST, key)) return RETAILER_ALLOWLIST[key]
  if (/ official$/i.test(source)) {
    const brand = source.replace(/ official$/i, '').trim()
    return brand || null
  }
  return null
}

function isConfigured() {
  return !!process.env.SERPAPI_API_KEY
}

// A live test turned up "Refurbished iPhone 16" listings with no
// second_hand_condition set at all (only the title gave it away) — so the
// title itself is checked too, not just that one field, before trusting a
// listing as new.
const USED_TITLE_PATTERN = /\b(refurbished|renewed|pre[- ]?owned|open[- ]?box|used)\b/i

// Query stopwords excluded when checking a result's title actually mentions
// the searched product — kept short and generic on purpose (over-excluding
// a real word risks throwing out a genuine match; these are just noise
// words unlikely to be the thing a search is actually about). "inch"/"in"
// are skipped too: a live test for "Samsung 65 inch TV" showed real
// listings almost never spell the word out, writing 65" instead — the size
// itself still has to match (a bare "65" is checked like any other token),
// this only excuses the unit word.
const QUERY_STOPWORDS = new Set(['a', 'an', 'the', 'for', 'and', 'with', 'of', 'in', 'on', 'inch', 'inches'])

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// A live test for "Dyson V15 vacuum" returned a Chewy listing for the
// "Dyson Gen5detect Cordless Vacuum" — a real, in-stock, new-condition
// listing, just for a different model than what was searched. Google
// Shopping's own relevance ranking doesn't guarantee every result actually
// names the product searched for, so this re-checks it directly: every
// significant word from the query (brand, model number, etc.) has to
// appear in the result's own title, whole-word, before it's trusted as the
// same product — the same word-boundary-safe approach used elsewhere in
// this app's own search (see searchPurchasesForPriceFinder in derive.js),
// so a short model number like "V15" can't accidentally match a stray
// substring, and a real difference in model can't slip through as if it
// were comparable.
function titleMatchesQuery(title, query) {
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 1 && !QUERY_STOPWORDS.has(w))
  if (!tokens.length) return true
  const hay = (title || '').toLowerCase()
  return tokens.every((w) => new RegExp(`\\b${escapeRegExp(w)}\\b`).test(hay))
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
        if (USED_TITLE_PATTERN.test(r.title || '')) return false // caught by title even when the field above isn't set
        if (r.installment) return false // a "$29/mo" financing price, not the item's actual price
        if (typeof r.extracted_price !== 'number') return false // no verifiable price
        if (!titleMatchesQuery(r.title, term)) return false // a different product than what was searched
        return !!resolveStore(r.source)
      })
      .map((r) => ({
        store: resolveStore(r.source),
        title: r.title,
        price: r.extracted_price,
        oldPrice: typeof r.extracted_old_price === 'number' ? r.extracted_old_price : null,
        link: r.product_link || null,
        rating: typeof r.rating === 'number' ? r.rating : null,
        reviews: typeof r.reviews === 'number' ? r.reviews : null,
        thumbnail: r.thumbnail || null,
        // Not r.source_icon: SerpApi's icon there is a generic Google
        // Shopping merchant badge (e.g. a plain price-tag glyph for every
        // "Best Buy" result), not the retailer's actual logo — the client
        // guesses a real one from the store's domain instead.
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
