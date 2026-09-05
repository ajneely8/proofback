import {
  STORAGE_KEY,
  ONBOARDING_KEY,
  SETTINGS_KEY,
  DEFAULT_SETTINGS,
} from '../data/mockData.js'

// IDs from the old hardcoded demo dataset (Nike Air Max, Amazon orders,
// Samsung TV, etc.) that a previous version of this app seeded into
// localStorage whenever it was empty. That fallback is gone from the code,
// but anyone who loaded the app before this fix already has those rows
// saved as if they were real purchases — removing the code doesn't touch
// data already written to their browser. Filtering them out here means any
// such visitor self-heals on their next load instead of needing to clear
// site data by hand.
const FAKE_DEMO_IDS = new Set(['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10', 'p11'])

export function loadPurchases() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const cleaned = parsed.filter((p) => !FAKE_DEMO_IDS.has(p?.id))
    if (cleaned.length !== parsed.length) savePurchases(cleaned)
    return cleaned
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
