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

  return (
    <PurchasesContext.Provider value={{ purchases, addPurchase }}>
      {children}
    </PurchasesContext.Provider>
  )
}

export function usePurchases() {
  const ctx = useContext(PurchasesContext)
  if (!ctx) throw new Error('usePurchases must be used within PurchasesProvider')
  return ctx
}
