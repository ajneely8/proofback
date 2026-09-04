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

export function logoUrlFor(name) {
  const domain = guessDomain(name)
  return domain ? `https://logo.clearbit.com/${domain}?size=160` : null
}

// A purchase's own logoUrl (set at scan time) wins when present; otherwise
// this computes one on the fly from brand/store, so older saved purchases
// still get a logo instead of only ever showing the initial-letter badge.
export function purchaseLogoUrl(purchase) {
  return purchase.logoUrl || logoUrlFor(purchase.brand || purchase.store)
}
