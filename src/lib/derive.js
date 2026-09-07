import { DEFAULT_SETTINGS, RETURN_ALERT_THRESHOLDS, WARRANTY_ALERT_THRESHOLDS } from '../data/mockData.js'

// Parse a "YYYY-MM-DD" string as a local-midnight Date, avoiding the UTC
// interpretation `new Date(str)` uses (which shifts the displayed day in
// timezones behind UTC).
function parseLocalDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

// Today, at local midnight — the real current date, not a fixed mock value.
// Every deadline/countdown in the app is computed relative to this, so it
// has to track actual elapsed time, not a snapshot from whenever this file
// was last touched.
function today() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

export function daysUntil(dateStr) {
  if (!dateStr) return null
  const target = parseLocalDate(dateStr)
  const ms = target - today()
  return Math.round(ms / 86400000)
}

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = parseLocalDate(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// timeStr is "HH:MM" in 24-hour time, as read off the receipt.
export function formatTime(timeStr) {
  if (!timeStr) return null
  const [hours, minutes] = timeStr.split(':').map(Number)
  const d = new Date(2000, 0, 1, hours, minutes)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export function formatDateTime(dateStr, timeStr) {
  const date = formatDate(dateStr)
  const time = formatTime(timeStr)
  return time ? `${date} at ${time}` : date
}

export function formatMoney(amount) {
  if (amount == null) return '—'
  return Number(amount).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  })
}

// Whole days between two "YYYY-MM-DD" strings (b - a), independent of the
// current date — used to compare two purchases' dates to each other, not a
// date to today.
function daysBetween(aStr, bStr) {
  if (!aStr || !bStr) return null
  const ms = parseLocalDate(bStr) - parseLocalDate(aStr)
  return Math.round(ms / 86400000)
}

export function returnIsOpen(purchase) {
  const d = daysUntil(purchase.returnDeadline)
  return d !== null && d >= 0
}

export function refundMissing(purchase) {
  return purchase.refund?.status === 'expected_missing'
}

// A missing refund becomes "overdue" once its expected date has actually
// passed — distinct from just "expected_missing" the moment it's logged, so
// the UI can tell "still waiting, on schedule" from "this is late."
export function refundOverdue(purchase) {
  if (!refundMissing(purchase) || !purchase.refund?.expectedDate) return false
  const d = daysUntil(purchase.refund.expectedDate)
  return d !== null && d < 0
}

// A purchase's return/refund state, as however many of these are true at
// once — not a single exclusive status, since e.g. a missing refund and a
// closing return window can both apply to the same item at the same time.
// "Eligible for exchange" isn't a separate signal ProofBack actually has
// (no receipt states "exchange only"); it's inferred as available whenever
// a physical good is still inside its own return window, since a store
// that will take something back will almost always also swap it.
export function getPurchaseStatuses(purchase, settings = DEFAULT_SETTINGS) {
  const urgentWindowDays = settings.urgentWindowDays ?? DEFAULT_SETTINGS.urgentWindowDays
  const statuses = []
  const daysLeft = daysUntil(purchase.returnDeadline)
  const isOpen = daysLeft !== null && daysLeft >= 0
  const returnDone = purchase.returnStatus === 'completed'

  if (!returnDone && purchase.returnDeadline) {
    if (isOpen && daysLeft > urgentWindowDays) {
      statuses.push({ key: 'returnable', label: 'Return available', tone: 'good' })
    } else if (isOpen) {
      statuses.push({
        key: 'closing_soon',
        label: `Return deadline approaching — ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
        tone: 'warn',
      })
    } else {
      statuses.push({ key: 'closed', label: 'Return expired', tone: 'neutral' })
    }

    if (isOpen && ['Apparel', 'Electronics', 'Home'].includes(purchase.category)) {
      statuses.push({ key: 'exchange', label: 'Eligible for exchange', tone: 'good' })
    }
  } else if (!returnDone) {
    // No return deadline at all — never claim one we don't actually have.
    statuses.push({ key: 'return_unconfirmed', label: 'Return policy needs confirmation', tone: 'neutral' })
  }

  if (purchase.returnStatus === 'started') {
    statuses.push({ key: 'refund_pending', label: 'Waiting for refund', tone: 'warn' })
  }

  if (refundMissing(purchase)) {
    statuses.push({ key: 'refund_missing', label: 'Refund may be missing', tone: 'warn' })
  }

  if (purchase.warrantyExpires) {
    const warrantyDaysLeft = daysUntil(purchase.warrantyExpires)
    if (warrantyDaysLeft >= 0 && warrantyDaysLeft > urgentWindowDays) {
      statuses.push({ key: 'warranty_active', label: 'Warranty active', tone: 'good' })
    } else if (warrantyDaysLeft >= 0) {
      statuses.push({ key: 'warranty_expiring', label: 'Warranty expiring soon', tone: 'warn' })
    } else {
      statuses.push({ key: 'warranty_expired', label: 'Warranty expired', tone: 'neutral' })
    }
  }

  return statuses
}

// A purchase's Protection Score: how much of the record ProofBack (or the
// user) has actually filled in, not a judgment of the item itself. Each
// check is something that materially helps a future return/warranty claim
// go through — missing ones are exactly what the "how to improve" hint on
// the detail page lists back to the user.
const PROTECTION_CHECKS = [
  { key: 'receipt', label: 'Receipt', met: (p) => (p.receiptImageUrls?.length || 0) > 0 || !!p.receiptImageUrl },
  { key: 'product', label: 'Product identified', met: (p) => !!(p.product && p.brand) },
  { key: 'return_deadline', label: 'Return deadline', met: (p) => !!p.returnDeadline },
  { key: 'warranty', label: 'Warranty', met: (p) => !!p.warrantyExpires },
  { key: 'serial_number', label: 'Serial number', met: (p) => !!p.serialNumber },
]

export function getProtectionScore(purchase) {
  const checks = PROTECTION_CHECKS.map((c) => ({ key: c.key, label: c.label, met: c.met(purchase) }))
  const metCount = checks.filter((c) => c.met).length
  const percent = Math.round((metCount / checks.length) * 100)
  return { percent, checks }
}

// What each kind of claim actually needs to go through — a return doesn't
// need a serial number, but an insurance claim does; scoring them all
// against the same generic checklist would tell the user to add things
// that particular claim doesn't even use. Reuses the same has-a-value
// checks as PROTECTION_CHECKS above rather than redefining them.
const CLAIM_TYPE_CHECKS = {
  return: [
    { key: 'receipt', label: 'Receipt', met: (p) => (p.receiptImageUrls?.length || 0) > 0 || !!p.receiptImageUrl },
    { key: 'return_deadline', label: 'Return deadline', met: (p) => !!p.returnDeadline },
    { key: 'order_number', label: 'Order number', met: (p) => !!p.orderNumber },
  ],
  warranty: [
    { key: 'receipt', label: 'Receipt', met: (p) => (p.receiptImageUrls?.length || 0) > 0 || !!p.receiptImageUrl },
    { key: 'serial_number', label: 'Serial number', met: (p) => !!p.serialNumber },
    { key: 'warranty', label: 'Warranty expiration', met: (p) => !!p.warrantyExpires },
  ],
  chargeback: [
    { key: 'receipt', label: 'Receipt', met: (p) => (p.receiptImageUrls?.length || 0) > 0 || !!p.receiptImageUrl },
    { key: 'payment_method', label: 'Payment method', met: (p) => !!p.paymentMethod },
    { key: 'order_number', label: 'Order number', met: (p) => !!p.orderNumber },
    { key: 'purchase_date', label: 'Purchase date', met: (p) => !!p.purchaseDate },
  ],
  insurance: [
    { key: 'receipt', label: 'Receipt', met: (p) => (p.receiptImageUrls?.length || 0) > 0 || !!p.receiptImageUrl },
    { key: 'price', label: 'Price', met: (p) => p.price != null },
    { key: 'serial_number', label: 'Serial number', met: (p) => !!p.serialNumber },
    { key: 'product_photo', label: 'Product photo', met: (p) => !!p.productPhotoUrl },
  ],
}

// Proof Readiness: the same idea as Protection Score (an overall completeness
// read), plus a breakdown per claim type, since "ready enough" means
// different things for a return vs. an insurance claim.
export function getProofReadiness(purchase) {
  const overall = getProtectionScore(purchase)
  const byType = {}
  Object.entries(CLAIM_TYPE_CHECKS).forEach(([type, checks]) => {
    const evaluated = checks.map((c) => ({ key: c.key, label: c.label, met: c.met(purchase) }))
    const met = evaluated.filter((c) => c.met).length
    byType[type] = { percent: Math.round((met / evaluated.length) * 100), checks: evaluated }
  })
  return { overall, byType }
}

// Money the user has actually gotten back through a completed return or
// refund — distinct from getTotalSaved (which also counts price
// adjustments) and from totalRecoverable (which is still-potential money).
export function getMoneyRecovered(purchases) {
  const total = purchases.reduce((sum, p) => {
    if (p.returnStatus === 'completed') return sum + (Number(p.returnRecord?.refundAmount ?? p.price) || 0)
    if (p.refund?.status === 'received') return sum + (Number(p.price) || 0)
    return sum
  }, 0)
  return Math.round(total * 100) / 100
}

// Two purchases at the same store, for the same amount, logged within a few
// days of each other — the only "duplicate charge" signal ProofBack can
// actually see, since it has no access to real bank/card transactions. This
// flags a possible double-scan or an actual duplicate charge worth checking,
// never claims certainty either way.
const DUPLICATE_WINDOW_DAYS = 3

export function getDuplicatePurchaseFlags(purchases) {
  const flags = []
  for (let i = 0; i < purchases.length; i++) {
    for (let j = i + 1; j < purchases.length; j++) {
      const a = purchases[i]
      const b = purchases[j]
      if (a.recoveryCase || b.recoveryCase) continue
      if (!a.store || a.store !== b.store) continue
      if (Math.abs((Number(a.price) || 0) - (Number(b.price) || 0)) > 0.01) continue
      const gap = daysBetween(a.purchaseDate, b.purchaseDate)
      if (gap === null || Math.abs(gap) > DUPLICATE_WINDOW_DAYS) continue
      flags.push({ id: `${a.id}-${b.id}-dup`, purchases: [a, b], amount: Number(a.price) || 0 })
    }
  }
  return flags
}

// A recovery case is either the one the user has already started (persisted
// as `purchase.recoveryCase`) or, if none exists yet, one ProofBack
// auto-detects as an open opportunity — a return window still open, a
// missing refund, or a possible duplicate purchase. Auto-detected cases
// aren't persisted until the user actually acts on them (Start Return/Start
// Claim/etc in PurchaseDetail.jsx), so browsing the dashboard never writes
// anything on its own.
export function getRecoveryCases(purchases, settings = DEFAULT_SETTINGS) {
  const notifications = settings.notifications ?? DEFAULT_SETTINGS.notifications
  const cases = []
  const withCase = new Set()

  purchases.forEach((p) => {
    if (p.recoveryCase) {
      cases.push({ ...p.recoveryCase, purchase: p })
      withCase.add(p.id)
    }
  })

  purchases.forEach((p) => {
    if (withCase.has(p.id)) return

    if (returnIsOpen(p) && p.returnStatus !== 'completed' && notifications.returnDeadlines) {
      cases.push({
        id: `${p.id}-case-return`,
        purchase: p,
        type: 'return',
        status: 'opportunity',
        amount: Number(p.price) || 0,
        eligibilityReason: 'Return window still open',
        deadline: p.returnDeadline,
        requiredEvidence: ['Receipt', 'Order number'],
        evidenceProvided: [
          (p.receiptImageUrls?.length || p.receiptImageUrl) ? 'Receipt' : null,
          p.orderNumber ? 'Order number' : null,
        ].filter(Boolean),
        submissionHistory: [],
        resolution: null,
      })
    }

    if (refundMissing(p) && notifications.refundAlerts) {
      cases.push({
        id: `${p.id}-case-refund`,
        purchase: p,
        type: 'refund',
        status: refundOverdue(p) ? 'awaiting_refund' : 'opportunity',
        amount: Number(p.refund?.expectedAmount ?? p.price) || 0,
        eligibilityReason: 'Expected refund not received',
        deadline: p.refund?.expectedDate || null,
        requiredEvidence: ['Receipt'],
        evidenceProvided: (p.receiptImageUrls?.length || p.receiptImageUrl) ? ['Receipt'] : [],
        submissionHistory: [],
        resolution: null,
      })
    }
  })

  getDuplicatePurchaseFlags(purchases).forEach((flag) => {
    if (withCase.has(flag.purchases[0].id) || withCase.has(flag.purchases[1].id)) return
    cases.push({
      id: flag.id,
      purchase: flag.purchases[0],
      relatedPurchase: flag.purchases[1],
      type: 'duplicate_purchase',
      status: 'opportunity',
      amount: flag.amount,
      eligibilityReason: `Same amount at ${flag.purchases[0].store}, logged ${Math.abs(daysBetween(flag.purchases[0].purchaseDate, flag.purchases[1].purchaseDate))} day(s) apart`,
      deadline: null,
      requiredEvidence: ['Both receipts'],
      evidenceProvided: [],
      submissionHistory: [],
      resolution: null,
    })
  })

  return cases
}

const OPEN_CASE_STATUSES = ['opportunity', 'evidence_ready', 'submitted', 'awaiting_refund']

// The one action worth surfacing for a case in its current state — used to
// replace generic "View" buttons wherever a recovery case is listed.
export function caseActionLabel(recoveryCase) {
  if (recoveryCase.status === 'awaiting_refund') return 'Track Refund'
  if (recoveryCase.status === 'evidence_ready' || recoveryCase.status === 'submitted') return 'Mark Resolved'
  if (recoveryCase.type === 'refund') return 'Track Refund'
  if (recoveryCase.type === 'return') return 'Start Return'
  return 'Start Claim'
}

export function getRecoverableTotal(purchases, settings = DEFAULT_SETTINGS) {
  const total = getRecoveryCases(purchases, settings)
    .filter((c) => OPEN_CASE_STATUSES.includes(c.status))
    .reduce((sum, c) => sum + (Number(c.amount) || 0), 0)
  return Math.round(total * 100) / 100
}

// "Act Soon": every purchase-level deadline that matters, merged into one
// urgency-sorted list — return deadlines, warranty expirations, and refunds
// that are actually overdue (not just "missing," which alone isn't urgent
// the day after purchase). The tone always matches daysLeft directly (never
// a separately-tracked value that could drift from it).
export function getActSoonItems(purchases, settings = DEFAULT_SETTINGS) {
  const notifications = settings.notifications ?? DEFAULT_SETTINGS.notifications
  const urgentWindowDays = settings.urgentWindowDays ?? DEFAULT_SETTINGS.urgentWindowDays
  const items = []

  function toneFor(daysLeft) {
    if (daysLeft < 0) return 'warn'
    if (daysLeft <= urgentWindowDays) return 'warn'
    return 'good'
  }

  purchases.forEach((p) => {
    const returnDays = daysUntil(p.returnDeadline)
    if (returnDays !== null && returnDays >= 0 && p.returnStatus !== 'completed' && notifications.returnDeadlines) {
      items.push({
        id: `${p.id}-actsoon-return`,
        purchase: p,
        kind: 'return',
        label: `${productLabel(p)} — return deadline`,
        daysLeft: returnDays,
        deadlineDate: p.returnDeadline,
        tone: toneFor(returnDays),
      })
    }

    const warrantyDays = daysUntil(p.warrantyExpires)
    if (warrantyDays !== null && warrantyDays >= 0 && notifications.warrantyAlerts) {
      items.push({
        id: `${p.id}-actsoon-warranty`,
        purchase: p,
        kind: 'warranty',
        label: `${productLabel(p)} — warranty expires`,
        daysLeft: warrantyDays,
        deadlineDate: p.warrantyExpires,
        tone: toneFor(warrantyDays),
      })
    }

    if (refundOverdue(p) && notifications.refundAlerts) {
      const overdueDays = daysUntil(p.refund.expectedDate)
      items.push({
        id: `${p.id}-actsoon-refund`,
        purchase: p,
        kind: 'refund_overdue',
        label: `${p.brand} refund overdue`,
        daysLeft: overdueDays,
        deadlineDate: p.refund.expectedDate,
        tone: 'warn',
      })
    }
  })

  return items.sort((a, b) => a.daysLeft - b.daysLeft)
}

// "Your Impact": confirmed outcomes only — nothing still-potential counts
// here, that's Recoverable Now's job. `protectedCount` uses the same 60%
// threshold as the "incomplete" alert in getAlerts below, so a purchase
// that stops triggering that alert is exactly the one that starts counting
// as protected here.
export function getYourImpact(purchases) {
  const completedClaims = purchases.filter(
    (p) => p.recoveryCase?.status === 'recovered' || p.returnStatus === 'completed' || p.refund?.status === 'received'
  ).length
  const protectedCount = purchases.filter((p) => getProtectionScore(p).percent >= 60).length

  return {
    totalSaved: getTotalSaved(purchases),
    totalRecovered: getMoneyRecovered(purchases),
    protectedCount,
    completedClaims,
  }
}

// A persistent, dismissible alert feed (unlike notify.js's ephemeral OS
// notification) — a return/warranty crosses in the moment it's within any
// threshold in RETURN_ALERT_THRESHOLDS/WARRANTY_ALERT_THRESHOLDS, gated by
// the same per-category notification toggles as getNeedsAttention.
export function getAlerts(purchases, settings = DEFAULT_SETTINGS) {
  const notifications = settings.notifications ?? DEFAULT_SETTINGS.notifications
  const alerts = []

  purchases.forEach((p) => {
    const daysLeft = daysUntil(p.returnDeadline)
    if (daysLeft !== null && daysLeft >= 0 && notifications.returnDeadlines) {
      const threshold = RETURN_ALERT_THRESHOLDS.find((t) => daysLeft <= t)
      if (threshold != null) {
        alerts.push({
          id: `${p.id}-alert-return`,
          purchase: p,
          type: 'return_deadline',
          urgent: daysLeft <= 3,
          daysLeft,
          message:
            daysLeft === 0
              ? `Your ${p.brand} return deadline is today.`
              : `Your ${p.brand} return deadline is in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`,
        })
      }
    }

    const warrantyDaysLeft = daysUntil(p.warrantyExpires)
    if (warrantyDaysLeft !== null && warrantyDaysLeft >= 0 && notifications.warrantyAlerts) {
      const threshold = WARRANTY_ALERT_THRESHOLDS.find((t) => warrantyDaysLeft <= t)
      if (threshold != null) {
        alerts.push({
          id: `${p.id}-alert-warranty`,
          purchase: p,
          type: 'warranty_expiring',
          urgent: warrantyDaysLeft <= 7,
          daysLeft: warrantyDaysLeft,
          message: `Your ${p.brand} warranty expires in ${warrantyDaysLeft} day${warrantyDaysLeft === 1 ? '' : 's'}.`,
        })
      }
    }

    if (refundMissing(p) && notifications.refundAlerts) {
      alerts.push({
        id: `${p.id}-alert-refund`,
        purchase: p,
        type: 'refund_missing',
        urgent: true,
        daysLeft: null,
        message: `Your expected refund from ${p.brand} hasn't shown up yet.`,
      })
    }

    const protection = getProtectionScore(p)
    if (protection.percent < 60) {
      alerts.push({
        id: `${p.id}-alert-incomplete`,
        purchase: p,
        type: 'incomplete',
        urgent: false,
        daysLeft: null,
        message: `Your protection information for ${productLabel(p)} is incomplete.`,
      })
    }
  })

  return alerts.sort((a, b) => (a.daysLeft ?? 999) - (b.daysLeft ?? 999))
}

// Everything the Purchase Dashboard's stat tiles need, computed once over
// the full purchases array so the Home screen stays a thin rendering layer.
export function getDashboardStats(purchases, settings = DEFAULT_SETTINGS) {
  const totalPurchases = purchases.length
  const totalSpent = Math.round(purchases.reduce((sum, p) => sum + (Number(p.price) || 0), 0) * 100) / 100
  const eligibleForReturn = purchases.filter((p) => returnIsOpen(p) && p.returnStatus !== 'completed').length
  const upcomingReturnDeadlines = purchases.filter((p) => {
    const d = daysUntil(p.returnDeadline)
    return d !== null && d >= 0 && d <= 30 && p.returnStatus !== 'completed'
  }).length
  const activeWarranties = purchases.filter((p) => {
    const d = daysUntil(p.warrantyExpires)
    return d !== null && d >= 0
  }).length
  const warrantiesExpiringSoon = purchases.filter((p) => {
    const d = daysUntil(p.warrantyExpires)
    return d !== null && d >= 0 && d <= 30
  }).length
  const recentlyAdded = [...purchases]
    .sort((a, b) => (a.purchaseDate < b.purchaseDate ? 1 : -1))
    .slice(0, 5)

  return {
    totalPurchases,
    totalSpent,
    eligibleForReturn,
    upcomingReturnDeadlines,
    activeWarranties,
    warrantiesExpiringSoon,
    recoverable: totalRecoverable(purchases, settings),
    recovered: getMoneyRecovered(purchases),
    recentlyAdded,
  }
}

export function todayISO() {
  const t = today()
  const y = t.getFullYear()
  const m = String(t.getMonth() + 1).padStart(2, '0')
  const d = String(t.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Money actually recovered, as confirmed by the user's own actions (marking
// a refund received or a return completed) — not the same as the
// "potential" amounts in getOpportunities, which are just things ProofBack
// noticed and hasn't been told the outcome of.
export function getSavingsEvents(purchases) {
  const events = []

  purchases.forEach((p) => {
    if (p.refund?.status === 'received' && p.refund.receivedDate) {
      events.push({
        id: `${p.id}-refund-event`,
        purchase: p,
        date: p.refund.receivedDate,
        amount: p.price,
        label: 'Refund received',
      })
    }
    if (p.returnStatus === 'completed' && p.returnCompletedDate) {
      events.push({
        id: `${p.id}-return-event`,
        purchase: p,
        date: p.returnCompletedDate,
        amount: p.price,
        label: 'Return completed',
      })
    }
  })

  return events.sort((a, b) => (a.date < b.date ? 1 : -1))
}

export function getTotalSaved(purchases) {
  const total = getSavingsEvents(purchases).reduce((sum, e) => sum + e.amount, 0)
  return Math.round(total * 100) / 100
}

// Discounts already applied at checkout — a different kind of savings than
// getSavingsEvents (which is a return/refund the user confirmed after the
// fact): this already happened, right there on the receipt, so it's counted
// the moment a purchase is saved rather than waiting on any action.
export function getTotalDiscountSaved(purchases) {
  const total = purchases.reduce((sum, p) => sum + (Number(p.itemDiscount) || 0), 0)
  return Math.round(total * 100) / 100
}

// Opportunities: return deadlines closing soon and missing refunds.
// `settings.notifications` gates each category off when the user has turned that alert type off in Profile;
// `settings.reminderWindowDays` controls how many days out a closing return deadline counts as one.
export function getOpportunities(purchases, settings = DEFAULT_SETTINGS) {
  const notifications = settings.notifications ?? DEFAULT_SETTINGS.notifications
  const urgentWindowDays = settings.urgentWindowDays ?? DEFAULT_SETTINGS.urgentWindowDays
  const opps = []

  purchases.forEach((p) => {
    if (refundMissing(p) && notifications.refundAlerts) {
      opps.push({
        id: `${p.id}-refund`,
        type: 'refund_missing',
        amount: p.price,
        title: 'Refund may be missing',
        purchase: p,
        detail: `${p.brand} purchase`,
        note: 'Expected refund has not been detected.',
        action: 'Review',
      })
    }

    const daysLeft = daysUntil(p.returnDeadline)
    if (daysLeft !== null && daysLeft >= 0 && daysLeft <= urgentWindowDays && notifications.returnDeadlines) {
      opps.push({
        id: `${p.id}-return`,
        type: 'return_deadline',
        amount: p.price,
        title: 'Return deadline approaching',
        purchase: p,
        detail: `${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining.`,
        note: '',
        action: 'Start Return',
      })
    }
  })

  return opps.sort((a, b) => b.amount - a.amount)
}

export function totalRecoverable(purchases, settings = DEFAULT_SETTINGS) {
  const opps = getOpportunities(purchases, settings)
  const seen = new Set()
  let total = 0
  opps.forEach((o) => {
    // Avoid double-counting the same purchase's full price across multiple opportunity types.
    const key = `${o.purchase.id}-value`
    if (!seen.has(key)) {
      seen.add(key)
      total += o.type === 'refund_missing' ? o.amount : 0
    }
  })
  return Math.round(total * 100) / 100
}

// Shoes and clothing are ambiguous without a size and gender/fit ("Nike
// P-6000" alone doesn't say which), so both are appended wherever a
// product's name is shown — not just on its own detail page — whenever the
// receipt had them.
export function productLabel(p) {
  const suffix = [p.gender, p.size ? `Size ${p.size}` : null].filter(Boolean).join(', ')
  return `${p.brand} ${p.product}${p.quantity > 1 ? ` ×${p.quantity}` : ''}${suffix ? ` — ${suffix}` : ''}`
}

// One color per category, used as a quick-scan left-border/badge accent on
// list rows so the list reads at a glance instead of every row looking
// identical regardless of what it actually is.
const CATEGORY_COLORS = {
  Electronics: '#2E6FBF',
  Apparel: '#8A5CF6',
  Home: '#279A49',
  Grocery: '#C98A12',
  Other: '#9A9EA3',
}

export function categoryColor(category) {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS.Other
}

// Total spent per category, largest first — skips categories with nothing
// spent so the Insights screen doesn't show a row of zeroes.
export function getSpendByCategory(purchases) {
  const totals = {}
  purchases.forEach((p) => {
    const cat = p.category || 'Other'
    totals[cat] = (totals[cat] || 0) + (Number(p.price) || 0)
  })
  return Object.entries(totals)
    .map(([category, total]) => ({ category, total: Math.round(total * 100) / 100 }))
    .sort((a, b) => b.total - a.total)
}

// Total spent per calendar month over the trailing `months` months
// (default 6), oldest first — always includes every month in that range
// even at $0, so the chart's x-axis stays evenly spaced.
export function getSpendByMonth(purchases, months = 6) {
  const thisMonth = new Date(today().getFullYear(), today().getMonth(), 1)
  const buckets = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(thisMonth.getFullYear(), thisMonth.getMonth() - i, 1)
    buckets.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('en-US', { month: 'short' }),
      total: 0,
    })
  }
  const byKey = Object.fromEntries(buckets.map((b) => [b.key, b]))
  purchases.forEach((p) => {
    if (!p.purchaseDate) return
    const key = p.purchaseDate.slice(0, 7)
    if (byKey[key]) byKey[key].total += Number(p.price) || 0
  })
  return buckets.map((b) => ({ ...b, total: Math.round(b.total * 100) / 100 }))
}

export function getNeedsAttention(purchases, settings = DEFAULT_SETTINGS) {
  const notifications = settings.notifications ?? DEFAULT_SETTINGS.notifications
  const reminderWindowDays = settings.reminderWindowDays ?? DEFAULT_SETTINGS.reminderWindowDays
  const urgentWindowDays = settings.urgentWindowDays ?? DEFAULT_SETTINGS.urgentWindowDays
  const items = []

  purchases.forEach((p) => {
    const daysLeft = daysUntil(p.returnDeadline)
    if (daysLeft !== null && daysLeft >= 0 && daysLeft <= reminderWindowDays && notifications.returnDeadlines) {
      items.push({
        id: `${p.id}-attn-return`,
        purchase: p,
        label: productLabel(p),
        primaryText: `Return deadline: ${formatDate(p.returnDeadline)}`,
        secondaryText: null,
        urgent: daysLeft <= urgentWindowDays,
        daysLeft,
        windowDays: reminderWindowDays,
      })
    } else if (refundMissing(p) && notifications.refundAlerts) {
      items.push({
        id: `${p.id}-attn-refund`,
        purchase: p,
        label: p.brand,
        primaryText: `Refund expected: ${formatDate(p.refund.expectedDate)}`,
        secondaryText: 'Refund not received',
        urgent: true,
        daysLeft: null,
        windowDays: null,
      })
    }

    const warrantyDaysLeft = daysUntil(p.warrantyExpires)
    if (warrantyDaysLeft !== null && warrantyDaysLeft >= 0 && warrantyDaysLeft <= reminderWindowDays && notifications.warrantyAlerts) {
      items.push({
        id: `${p.id}-attn-warranty`,
        purchase: p,
        label: productLabel(p),
        primaryText: `Warranty expires: ${formatDate(p.warrantyExpires)}`,
        secondaryText: null,
        urgent: warrantyDaysLeft <= urgentWindowDays,
        daysLeft: warrantyDaysLeft,
        windowDays: reminderWindowDays,
      })
    }
  })

  return items
}
