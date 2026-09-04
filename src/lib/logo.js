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

// Google's favicon service goes first — it's been stable for over a decade
// and virtually always resolves, even though the result is a small icon
// rather than a full logo. Clearbit's logo endpoint is tried second: when it
// works it's a nicer, bigger brand mark, but it's proven too unreliable
// (slow, rate-limited, or outright unreachable depending on network) to lead
// with. Returns [] (not null) when there's no name to guess a domain from at
// all, so callers can just check .length.
export function logoCandidatesFor(name) {
  const domain = guessDomain(name)
  if (!domain) return []
  return [
    `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
    `https://logo.clearbit.com/${domain}?size=160`,
  ]
}

// Candidates computed from brand/store lead (Google favicon, then Clearbit)
// so this always tries the more reliable source first, regardless of which
// one a scan happened to save. A purchase's own logoUrl is appended as a
// last resort in case it points somewhere the domain guess wouldn't.
export function purchaseLogoCandidates(purchase) {
  const computed = logoCandidatesFor(purchase.brand || purchase.store)
  return purchase.logoUrl && !computed.includes(purchase.logoUrl)
    ? [...computed, purchase.logoUrl]
    : computed
}
