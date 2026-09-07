/**
 * Real, free, no-auth lookup against CPSC's public SaferProducts.gov recall
 * database — shared between server/index.js (Express, local dev) and
 * api/check-recall.js (Vercel serverless function), same split as
 * server/scanReceipt.js.
 *
 * This is a NAME match only (product name/brand as text), not a UPC/model
 * lookup — CPSC's public API doesn't support the latter well, and this app
 * has no UPC database of its own. A name match is never treated as a
 * confirmed recall of the user's exact item: the response is always framed
 * as "potential match, go verify" (see PurchaseDetail.jsx's recall card),
 * the same honesty rule this app applies to estimated return windows and
 * warranty dates.
 */

const RECALL_API_URL = 'https://www.saferproducts.gov/RestWebServices/Recall'
const MAX_MATCHES = 3

/**
 * query: free-text product name (brand + product works well, e.g.
 * "Samsung 55 TV"). Returns { status: 'none_found' | 'potential_matches' |
 * 'error', matches: [...] }. Never throws — a failed/unreachable lookup is
 * just 'error' with no matches, not a crash.
 */
export async function checkRecall(query) {
  const term = (query || '').trim()
  if (!term) return { status: 'none_found', matches: [] }

  try {
    const url = `${RECALL_API_URL}?format=json&ProductName=${encodeURIComponent(term)}`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return { status: 'error', matches: [] }

    const data = await res.json()
    const results = Array.isArray(data) ? data : []
    if (!results.length) return { status: 'none_found', matches: [] }

    const matches = results.slice(0, MAX_MATCHES).map((r) => ({
      recallId: r.RecallID != null ? String(r.RecallID) : null,
      title: r.Title || 'Recall notice',
      recallDate: r.RecallDate || null,
      url: r.URL || null,
      hazard: Array.isArray(r.Hazards) && r.Hazards[0]?.Name ? r.Hazards[0].Name : null,
      remedy: Array.isArray(r.Remedies) && r.Remedies[0]?.Name ? r.Remedies[0].Name : null,
    }))

    return { status: 'potential_matches', matches }
  } catch {
    // Network error, timeout, or an unparseable response — fail quietly.
    // A recall check is a bonus signal, not something that should ever
    // surface as an error to the user or block anything.
    return { status: 'error', matches: [] }
  }
}
