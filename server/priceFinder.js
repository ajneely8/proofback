/**
 * Real product-price search for Price Finder, via SerpApi's Google Shopping
 * engine — shared between server/index.js (Express, local dev) and
 * api/price-finder-search.js (Vercel serverless function), same split as
 * server/scanReceipt.js and server/checkRecall.js.
 *
 * Every real company selling the product is shown, not just a hand-picked
 * list of major retailers — per explicit instruction to make this behave
 * like an actual Google product search. What's still filtered out: used/
 * refurbished listings (a different product than a new one), third-party
 * marketplace sellers riding on a bigger platform's storefront (e.g.
 * "Walmart - TheRightOne" is a random seller, not Walmart itself), and a
 * denylist of known resale/auction marketplaces (eBay, Poshmark, StockX,
 * etc.) — none of those are a store "having" the product in the sense this
 * feature means. Anything else Google Shopping names as the source is
 * trusted and shown as itself.
 */

const SERPAPI_URL = 'https://serpapi.com/search.json'
const MAX_MATCHES = 30

// Not a gate anymore (see resolveStore) — just cleans up display names for
// stores commonly seen in inconsistent casing/punctuation (e.g. "bestbuy"
// or "kohl's.com" both becoming "Best Buy"/"Kohl's"). A source not listed
// here is still shown, using SerpApi's own name for it as-is.
const RETAILER_DISPLAY_NAMES = {
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
  heb: 'H-E-B',
  'h-e-b': 'H-E-B',
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

// Resale/auction/peer-to-peer marketplaces — real companies, but not a
// "store selling this product" in the sense this feature means: prices
// there are set by individual sellers, not the platform, and items are
// frequently used even when not flagged as such. Built from live testing
// plus well-known resale platforms; expand as more turn up.
const RESALE_MARKETPLACE_DENYLIST = new Set([
  'ebay', 'poshmark', 'mercari', 'whatnot', 'bonanza', 'stockx', 'goat', 'swappa', 'thredup', 'grailed',
  'depop', 'vinted', 'offerup', 'facebook marketplace', 'craigslist', 'tiktok shop', 'letgo', 'gumtree',
  'ebid', 'flip', 'kidizen', 'etsy', 'rebag', 'the realreal', 'therealreal', 'vestiaire collective',
  'worthy', 'gazelle', 'decluttr', 'unclaimed baggage', 'winmark', 'once upon a child', 'plato\'s closet',
])

// Rent-to-own retailers quote a weekly/monthly rental rate as their
// "price" (a live test showed Rent-A-Center listing $23.99 for a TV
// priced $999+ everywhere else) — not the item's purchase price, and not
// caught by the installment-field check since it's structured differently
// from a financing plan.
const RENT_TO_OWN_DENYLIST = new Set(['rent-a-center', "aaron's", 'aarons', 'acima', 'progressive leasing'])

// Google Shopping tags a manufacturer's own first-party storefront with a
// literal "<Brand> Official" source (confirmed live for "Dyson Official").
function resolveStore(rawSource) {
  const source = (rawSource || '').trim()
  if (!source) return null
  const key = source.toLowerCase()

  // A third-party seller riding on a bigger platform's marketplace (e.g.
  // "Walmart - TheRightOne", "Bonanza - Some Little Shop") isn't the
  // platform itself selling — the seller after the dash is unverified,
  // so the whole listing is rejected rather than credited to the platform
  // name before the dash.
  if (source.includes(' - ')) return null

  if (RESALE_MARKETPLACE_DENYLIST.has(key)) return null
  if (RENT_TO_OWN_DENYLIST.has(key)) return null

  if (/ official$/i.test(source)) {
    const brand = source.replace(/ official$/i, '').trim()
    return brand || null
  }

  return RETAILER_DISPLAY_NAMES[key] || source
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
// listing, just for a different model than what was searched. The fix
// (originally requiring every query word to appear in the title) turned
// out too strict the other way: a plain category search like "shoes"
// returns real listings titled with the specific shoe name ("Nike Men's
// Air VaporMax Plus"), which never repeats the generic word "shoes" at
// all — so EVERY result got filtered out for a perfectly normal search.
// The actual discriminating signal in the Dyson case was the model number
// ("V15"), not the category word ("vacuum") — so only tokens that look
// like a model/version identifier (containing a digit) are required to
// literally appear in the title; a query with no such token (a bare
// category search, or just a brand name) is trusted as-is, same as
// Google Shopping's own relevance ranking already handles it.
function titleMatchesQuery(title, query) {
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 1 && !QUERY_STOPWORDS.has(w))
  const modelTokens = tokens.filter((w) => /\d/.test(w))
  if (!modelTokens.length) return true
  const hay = (title || '').toLowerCase()
  return modelTokens.every((w) => new RegExp(`\\b${escapeRegExp(w)}\\b`).test(hay))
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

    const candidates = results.filter((r) => {
      if (r.second_hand_condition) return false // used/refurbished — a different product
      if (USED_TITLE_PATTERN.test(r.title || '')) return false // caught by title even when the field above isn't set
      if (r.installment) return false // a "$29/mo" financing price, not the item's actual price
      if (typeof r.extracted_price !== 'number') return false // no verifiable price
      if (!titleMatchesQuery(r.title, term)) return false // a different product than what was searched
      return !!resolveStore(r.source)
    })

    // Two quality checks now that any real store name is accepted, not
    // just a curated list — a live test opening that up returned a $22.45
    // listing for a $650 vacuum (from a store whose other listings for the
    // same item were $585-$744) and a bearings-parts supplier selling the
    // same vacuum, neither of which showed up on a curated list because
    // they were never trustworthy, not because they were merely unknown.
    const prices = candidates.map((r) => r.extracted_price).sort((a, b) => a - b)
    const median = prices.length ? prices[Math.floor(prices.length / 2)] : null

    const matches = candidates
      .filter((r) => {
        // An implausibly-cheap outlier vs. everyone else pricing the same
        // product — only checked with enough listings to trust the
        // median, and only against being too LOW (a high price isn't
        // itself suspicious the way a "too good to be true" one is).
        if (median && prices.length >= 3 && r.extracted_price < median * 0.3) return false
        // No rating AND no review count at all — every legitimate listing
        // in testing had at least one of these; a store with neither read
        // as an automated reseller with no real track record rather than
        // an actual storefront.
        if (r.rating == null && r.reviews == null) return false
        return true
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
