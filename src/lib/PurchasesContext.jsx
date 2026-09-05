import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from './supabaseClient.js'
import { useAuth } from './AuthContext.jsx'
import { loadPurchases, savePurchases } from './storage.js'

const PurchasesContext = createContext(null)

export function PurchasesProvider({ children }) {
  const { user } = useAuth()
  // Accounts are opt-in until Supabase is configured — until then this
  // behaves exactly as it did before accounts existed, reading/writing
  // local storage directly with no login required.
  const [purchases, setPurchases] = useState(isSupabaseConfigured ? [] : loadPurchases)
  const [loading, setLoading] = useState(isSupabaseConfigured)

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) return
    if (!user) {
      setPurchases([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('purchases')
      .select('data')
      .eq('user_id', user.id)
      .order('purchase_date', { ascending: false })
    if (!error && data) setPurchases(data.map((row) => row.data))
    setLoading(false)
  }, [user])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!isSupabaseConfigured) savePurchases(purchases)
  }, [purchases])

  async function addPurchase(purchase) {
    if (!isSupabaseConfigured) {
      setPurchases((prev) => [purchase, ...prev])
      return
    }
    if (!user) return
    setPurchases((prev) => [purchase, ...prev])
    const { error } = await supabase.from('purchases').insert({
      id: purchase.id,
      user_id: user.id,
      data: purchase,
      purchase_date: purchase.purchaseDate || null,
    })
    if (error) refresh() // roll back the optimistic update if the write actually failed
  }

  async function updatePurchase(id, patch) {
    if (!isSupabaseConfigured) {
      setPurchases((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))
      return
    }
    if (!user) return
    let updated = null
    setPurchases((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p
        updated = { ...p, ...patch }
        return updated
      })
    )
    if (!updated) return
    const { error } = await supabase
      .from('purchases')
      .update({ data: updated, purchase_date: updated.purchaseDate || null })
      .eq('id', id)
      .eq('user_id', user.id)
    if (error) refresh()
  }

  return (
    <PurchasesContext.Provider value={{ purchases, addPurchase, updatePurchase, loading, refresh }}>
      {children}
    </PurchasesContext.Provider>
  )
}

export function usePurchases() {
  const ctx = useContext(PurchasesContext)
  if (!ctx) throw new Error('usePurchases must be used within PurchasesProvider')
  return ctx
}
