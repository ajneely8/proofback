import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from './supabaseClient.js'
import { useAuth } from './AuthContext.jsx'
import { DEFAULT_SETTINGS } from '../data/mockData.js'
import { loadSettings, saveSettings } from './storage.js'

const SettingsContext = createContext(null)

export function SettingsProvider({ children }) {
  const { user } = useAuth()
  // Accounts are opt-in until Supabase is configured — until then this
  // behaves exactly as it did before accounts existed, reading/writing
  // local storage directly with no login required.
  const [settings, setSettings] = useState(isSupabaseConfigured ? DEFAULT_SETTINGS : loadSettings)
  const [loaded, setLoaded] = useState(!isSupabaseConfigured)

  useEffect(() => {
    if (!isSupabaseConfigured) return
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
    if (!isSupabaseConfigured) {
      saveSettings(settings)
      return
    }
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
