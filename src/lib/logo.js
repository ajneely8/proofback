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

// unavatar.io tries several logo providers per domain and serves whichever
// actually has a real brand mark — it goes first because it usually returns
// the retailer's full wordmark (e.g. Best Buy's actual "BEST BUY" logo),
// not just a bare favicon. `fallback=false` makes it 404 on a miss instead
// of a generic placeholder avatar, so a real miss still falls through to
// the next candidate instead of silently showing the wrong image. Google's
// favicon service is the fallback after that: it's been stable for over a
// decade and virtually always resolves, even though the result is just a
// small icon (Best Buy's, for instance, is literally just their yellow tag
// mark with no wordmark). Clearbit's own direct logo endpoint used to be
// tried too, but it's been pulled entirely — the domain no longer resolves
// at all — so it's not listed as a candidate. Returns [] (not null) when
// there's no name to guess a domain from at all, so callers can just check
// .length.
export function logoCandidatesFor(name) {
  const domain = guessDomain(name)
  if (!domain) return []
  return [`https://unavatar.io/${domain}?fallback=false`, `https://www.google.com/s2/favicons?domain=${domain}&sz=128`]
}

// Candidates computed from brand/store lead (unavatar, then Google favicon)
// so this always tries the more reliable source first, regardless of which
// one a scan happened to save. A purchase's own logoUrl is appended as a
// last resort in case it points somewhere the domain guess wouldn't.
export function purchaseLogoCandidates(purchase) {
  const computed = logoCandidatesFor(purchase.brand || purchase.store)
  return purchase.logoUrl && !computed.includes(purchase.logoUrl)
    ? [...computed, purchase.logoUrl]
    : computed
}
