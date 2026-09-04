import { createContext, useContext, useEffect, useState } from 'react'
import { loadSettings, saveSettings } from './storage.js'

const SettingsContext = createContext(null)

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(loadSettings)

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

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
