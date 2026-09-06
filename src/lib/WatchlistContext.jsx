import { createContext, useContext, useEffect, useState } from 'react'
import { loadWatchlist, saveWatchlist } from './storage.js'

const WatchlistContext = createContext(null)

// Local-only for now, same as purchases/settings before accounts existed —
// there's no live price-fetching here (no retailer exposes a stable public
// price API, and scraping arbitrary stores breaks constantly), so this just
// tracks whatever price the user last told it they saw and flags it once
// that price meets their target.
export function WatchlistProvider({ children }) {
  const [items, setItems] = useState(loadWatchlist)

  useEffect(() => {
    saveWatchlist(items)
  }, [items])

  function addItem(item) {
    setItems((prev) => [item, ...prev])
  }

  function updateItem(id, patch) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  }

  function removeItem(id) {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  return (
    <WatchlistContext.Provider value={{ items, addItem, updateItem, removeItem }}>
      {children}
    </WatchlistContext.Provider>
  )
}

export function useWatchlist() {
  const ctx = useContext(WatchlistContext)
  if (!ctx) throw new Error('useWatchlist must be used within WatchlistProvider')
  return ctx
}
