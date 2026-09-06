// Reference "today" for this dataset. Deadlines below are expressed relative to it.
// Built with new Date(y, m, d) (local midnight) rather than new Date('2026-09-03')
// (parsed as UTC midnight), which shifted this back a day in any timezone behind
// UTC and threw off every "days remaining" calculation app-wide.
export const TODAY = new Date(2026, 8, 3)

export const STORAGE_KEY = 'proofback.purchases.v1'
export const ONBOARDING_KEY = 'proofback.onboarded.v1'
export const SETTINGS_KEY = 'proofback.settings.v1'

export const DEFAULT_SETTINGS = {
  name: '',
  email: '',
  connectedEmail: '',
  notifications: {
    returnDeadlines: true,
    priceDrops: true,
    refundAlerts: true,
    warrantyAlerts: true,
  },
  // How many days before a deadline ProofBack starts surfacing it under
  // Needs Attention/Opportunities, and how many days out counts as
  // "urgent" (closing soon) rather than just "still returnable".
  reminderWindowDays: 30,
  urgentWindowDays: 7,
  // 'system' follows the device's OS-level light/dark setting; 'light' and
  // 'dark' force it regardless of that setting.
  theme: 'system',
}
