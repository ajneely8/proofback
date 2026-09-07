export const STORAGE_KEY = 'proofback.purchases.v1'
export const ONBOARDING_KEY = 'proofback.onboarded.v1'
export const SETTINGS_KEY = 'proofback.settings.v1'

// Alert cadence, furthest-out first — a return deadline crosses into "needs
// attention" the moment it's within any of these thresholds, so it doesn't
// wait for a single fixed window the way the older reminderWindowDays did.
// Warranty alerts use a single user-configurable lead time instead
// (DEFAULT_SETTINGS.warrantyReminderDays) — see Notification settings.
export const RETURN_ALERT_THRESHOLDS = [30, 14, 7, 3, 1]

// Free plan cap: total purchases on the account, not scans-per-month — a
// single scan can create several purchase records (one per line item), so
// this is checked against the purchases table directly, not a scan counter.
export const FREE_PURCHASE_LIMIT = 5

export const DEFAULT_SETTINGS = {
  name: '',
  email: '',
  connectedEmail: '',
  notifications: {
    returnDeadlines: true,
    refundAlerts: true,
    warrantyAlerts: true,
  },
  // How many days before a deadline ProofBack starts surfacing it under
  // Needs Attention/Opportunities, and how many days out counts as
  // "urgent" (closing soon) rather than just "still returnable".
  reminderWindowDays: 30,
  urgentWindowDays: 7,
  // How many days before a warranty (or a warranty registration deadline)
  // expires the persistent Alerts feed starts surfacing it.
  warrantyReminderDays: 30,

  // 'system' follows the device's OS-level light/dark setting; 'light' and
  // 'dark' force it regardless of that setting.
  theme: 'system',
  // One of VALID_PLANS below, set for real via Stripe Checkout
  // (src/screens/profile/Subscription.jsx) once a subscription is active.
  plan: 'free',
}

// The only plan values Stripe/Subscription.jsx ever actually write. Any
// other stored value (a leftover from an older tier scheme, a hand-edited
// row, etc.) should be treated as 'free' rather than silently granting
// paid-tier access — see normalizePlan below.
export const VALID_PLANS = ['free', 'pro', 'family']

export function normalizePlan(plan) {
  return VALID_PLANS.includes(plan) ? plan : 'free'
}
