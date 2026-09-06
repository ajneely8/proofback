import { useEffect } from 'react'

// Forces light mode at all times, overriding both the OS-level
// prefers-color-scheme media query and any previously stored theme
// preference — the CSS in styles.css gives data-theme="light" priority
// over everything else.
export default function ThemeEffect() {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light')
  }, [])

  return null
}
