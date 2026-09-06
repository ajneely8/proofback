import { useEffect } from 'react'
import { useSettings } from '../lib/SettingsContext.jsx'

// Applies the user's explicit light/dark choice as a data-theme attribute
// on <html>, which the CSS in styles.css gives priority over the OS-level
// prefers-color-scheme media query. 'system' removes the attribute
// entirely, letting that media query decide as usual.
export default function ThemeEffect() {
  const { settings } = useSettings()

  useEffect(() => {
    const root = document.documentElement
    if (settings.theme === 'light' || settings.theme === 'dark') {
      root.setAttribute('data-theme', settings.theme)
    } else {
      root.removeAttribute('data-theme')
    }
  }, [settings.theme])

  return null
}
