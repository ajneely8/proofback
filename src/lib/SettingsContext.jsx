import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabaseClient.js'
import { useAuth } from './AuthContext.jsx'
import { DEFAULT_SETTINGS } from '../data/mockData.js'

const SettingsContext = createContext(null)

export function SettingsProvider({ children }) {
  const { user } = useAuth()
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!user) {
      setSettings(DEFAULT_SETTINGS)
      setLoaded(false)
      return
    }
    let cancelled = false
    supabase
      .from('user_settings')
      .select('data')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        setSettings(data?.data ? { ...DEFAULT_SETTINGS, ...data.data } : DEFAULT_SETTINGS)
        setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [user])

  // Persists after the initial load only — otherwise this would immediately
  // overwrite a just-fetched row with DEFAULT_SETTINGS on every login.
  useEffect(() => {
    if (!user || !loaded) return
    supabase.from('user_settings').upsert({ user_id: user.id, data: settings, updated_at: new Date().toISOString() })
  }, [settings, user, loaded])

  function updateSettings(patch) {
    setSettings((prev) => ({ ...prev, ...patch }))
  }

  function updateNotification(key, value) {
    setSettings((prev) => ({ ...prev, notifications: { ...prev.notifications, [key]: value } }))
  }

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, updateNotification }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}
