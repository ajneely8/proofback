import {
  STORAGE_KEY,
  ONBOARDING_KEY,
  SETTINGS_KEY,
  DEFAULT_SETTINGS,
} from '../data/mockData.js'

export function loadPurchases() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function savePurchases(purchases) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(purchases))
  } catch {
    // ignore write failures (private browsing, storage full)
  }
}

export function hasOnboarded() {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === '1'
  } catch {
    return false
  }
}

export function setOnboarded() {
  try {
    localStorage.setItem(ONBOARDING_KEY, '1')
  } catch {
    // ignore
  }
}

export function clearOnboarded() {
  try {
    localStorage.removeItem(ONBOARDING_KEY)
  } catch {
    // ignore
  }
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_SETTINGS, ...parsed, notifications: { ...DEFAULT_SETTINGS.notifications, ...parsed.notifications } }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // ignore write failures
  }
}
