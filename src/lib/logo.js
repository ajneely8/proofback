// Mirrors server/index.js's domain guessing so a purchase saved before the
// scan started returning logoUrl (or one imported/edited by hand) still gets
// a logo computed here from its brand/store name, instead of only ever
// working for freshly-scanned receipts.
const STORE_DOMAINS = {
  nike: 'nike.com',
  adidas: 'adidas.com',
  amazon: 'amazon.com',
  'best buy': 'bestbuy.com',
  target: 'target.com',
  walmart: 'walmart.com',
  costco: 'costco.com',
  'home depot': 'homedepot.com',
  lowes: 'lowes.com',
  "lowe's": 'lowes.com',
  apple: 'apple.com',
  samsung: 'samsung.com',
  macys: 'macys.com',
  "macy's": 'macys.com',
  kohls: 'kohls.com',
  "kohl's": 'kohls.com',
  ikea: 'ikea.com',
  wayfair: 'wayfair.com',
  'fleet feet': 'fleetfeet.com',
  brooks: 'brooksrunning.com',
  fully: 'fully.com',
  rei: 'rei.com',
  'dicks sporting goods': 'dickssportinggoods.com',
  "dick's sporting goods": 'dickssportinggoods.com',
}

function guessDomain(name) {
  if (!name) return null
  const key = name.trim().toLowerCase()
  if (STORE_DOMAINS[key]) return STORE_DOMAINS[key]
  const match = Object.keys(STORE_DOMAINS).find((known) => key.includes(known))
  if (match) return STORE_DOMAINS[match]
  const guess = key.replace(/[^a-z0-9]/g, '')
  return guess ? `${guess}.com` : null
}

// Clearbit's free logo endpoint has gotten unreliable (slow, rate-limited, or
// outright unreachable depending on network) — so this tries it first for
// quality, then falls back to Google's favicon service, which is far more
// consistently up even though the result is a lower-resolution icon rather
// than a full logo. Returns [] (not null) when there's no name to guess a
// domain from at all, so callers can just check .length.
export function logoCandidatesFor(name) {
  const domain = guessDomain(name)
  if (!domain) return []
  return [
    `https://logo.clearbit.com/${domain}?size=160`,
    `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
  ]
}

// A purchase's own logoUrl (set at scan time) wins as the first candidate
// when present; otherwise this computes candidates on the fly from
// brand/store, so older saved purchases still get a logo instead of only
// ever showing the initial-letter badge.
export function purchaseLogoCandidates(purchase) {
  const computed = logoCandidatesFor(purchase.brand || purchase.store)
  return purchase.logoUrl ? [purchase.logoUrl, ...computed] : computed
}
