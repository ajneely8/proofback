import { createContext, useContext, useEffect, useState } from 'react'
import { loadPurchases, savePurchases } from './storage.js'

const PurchasesContext = createContext(null)

export function PurchasesProvider({ children }) {
  const [purchases, setPurchases] = useState(loadPurchases)

  useEffect(() => {
    savePurchases(purchases)
  }, [purchases])

  function addPurchase(purchase) {
    setPurchases((prev) => [purchase, ...prev])
  }

  function updatePurchase(id, patch) {
    setPurchases((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }

  return (
    <PurchasesContext.Provider value={{ purchases, addPurchase, updatePurchase }}>
      {children}
    </PurchasesContext.Provider>
  )
}

export function usePurchases() {
  const ctx = useContext(PurchasesContext)
  if (!ctx) throw new Error('usePurchases must be used within PurchasesProvider')
  return ctx
}
