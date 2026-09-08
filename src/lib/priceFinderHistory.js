// Recent Searches for Price Finder — a plain per-browser list, same pattern
// as receiptInbox.js/ConnectedAccounts.jsx's localStorage-backed lists.
const STORAGE_KEY = 'proofback.priceFinderSearches.v1'
const MAX_ENTRIES = 10

export function loadRecentSearches() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function saveRecentSearches(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    // ignore write failures
  }
}

export function addRecentSearch(query) {
  const trimmed = query.trim()
  if (!trimmed) return
  const existing = loadRecentSearches().filter((s) => s.query.toLowerCase() !== trimmed.toLowerCase())
  const next = [{ id: `search-${Date.now()}`, query: trimmed, searchedAt: new Date().toISOString() }, ...existing].slice(
    0,
    MAX_ENTRIES
  )
  saveRecentSearches(next)
}

export function removeRecentSearch(id) {
  saveRecentSearches(loadRecentSearches().filter((s) => s.id !== id))
}

export function clearRecentSearches() {
  saveRecentSearches([])
}
