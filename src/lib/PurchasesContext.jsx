import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from './supabaseClient.js'
import { useAuth } from './AuthContext.jsx'
import { loadPurchases, savePurchases, clearLocalPurchases } from './storage.js'

const PurchasesContext = createContext(null)

export function PurchasesProvider({ children }) {
  const { user } = useAuth()
  // Local-storage mode covers two cases now, not just "Supabase isn't
  // configured": a visitor who hasn't signed up yet (using their 5 free
  // scans, see App.jsx) gets exactly the same no-login behavior a fully
  // unconfigured deployment already had — same functions, same storage key.
  const useLocal = !isSupabaseConfigured || !user
  const [purchases, setPurchases] = useState(useLocal ? loadPurchases : [])
  const [loading, setLoading] = useState(!useLocal)
  const migratingRef = useRef(false)

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured || !user) return
    setLoading(true)
    const { data, error } = await supabase
      .from('purchases')
      .select('data')
      .eq('user_id', user.id)
      .order('purchase_date', { ascending: false })
    if (!error && data) setPurchases(data.map((row) => row.data))
    setLoading(false)
  }, [user])

  // The moment an anonymous visitor (using local storage for their free
  // scans) signs up or logs in, carry whatever they'd already scanned into
  // the new account instead of it silently vanishing — best-effort: only
  // clear the local copy once every row has actually been saved remotely,
  // so a failed migration leaves the data recoverable rather than lost.
  useEffect(() => {
    if (!isSupabaseConfigured || !user || migratingRef.current) return
    const local = loadPurchases()
    if (!local.length) {
      refresh()
      return
    }
    migratingRef.current = true
    ;(async () => {
      let allOk = true
      for (const purchase of local) {
        const { error } = await supabase.from('purchases').insert({
          id: purchase.id,
          user_id: user.id,
          data: purchase,
          purchase_date: purchase.purchaseDate || null,
        })
        if (error) allOk = false
      }
      if (allOk) clearLocalPurchases()
      await refresh()
      migratingRef.current = false
    })()
  }, [user, refresh])

  useEffect(() => {
    if (useLocal) savePurchases(purchases)
  }, [useLocal, purchases])

  async function addPurchase(purchase) {
    if (useLocal) {
      setPurchases((prev) => [purchase, ...prev])
      return
    }
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
    if (useLocal) {
      setPurchases((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))
      return
    }
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

  async function deletePurchase(id) {
    if (useLocal) {
      setPurchases((prev) => prev.filter((p) => p.id !== id))
      return
    }
    const prevPurchases = purchases
    setPurchases((prev) => prev.filter((p) => p.id !== id))
    const { error } = await supabase.from('purchases').delete().eq('id', id).eq('user_id', user.id)
    if (error) setPurchases(prevPurchases) // roll back if the delete actually failed
  }

  async function deletePurchases(ids) {
    const idSet = new Set(ids)
    if (useLocal) {
      setPurchases((prev) => prev.filter((p) => !idSet.has(p.id)))
      return
    }
    const prevPurchases = purchases
    setPurchases((prev) => prev.filter((p) => !idSet.has(p.id)))
    const { error } = await supabase.from('purchases').delete().in('id', ids).eq('user_id', user.id)
    if (error) setPurchases(prevPurchases)
  }

  return (
    <PurchasesContext.Provider
      value={{ purchases, addPurchase, updatePurchase, deletePurchase, deletePurchases, loading, refresh }}
    >
      {children}
    </PurchasesContext.Provider>
  )
}

export function usePurchases() {
  const ctx = useContext(PurchasesContext)
  if (!ctx) throw new Error('usePurchases must be used within PurchasesProvider')
  return ctx
}
