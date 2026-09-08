import { DEFAULT_SETTINGS, RETURN_ALERT_THRESHOLDS } from '../data/mockData.js'

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

// A return deadline is the LAST day the window was open — once that day has
// fully elapsed (i.e. we're now on or past it), it's closed. Deliberately
// strict (> 0, not >= 0): the deadline date itself already counts as closed.
export function returnIsOpen(purchase) {
  const d = daysUntil(purchase.returnDeadline)
  return d !== null && d > 0
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
  const isOpen = daysLeft !== null && daysLeft > 0
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
      statuses.push({ key: 'closed', label: 'Return window closed', tone: 'warn' })
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
  } else if (purchase.warrantyEligible) {
    statuses.push({ key: 'warranty_not_confirmed', label: 'Warranty not confirmed', tone: 'neutral' })
  }

  return statuses
}

// One of five buckets for the Purchases warranty filters — 'none' covers
// both a non-warrantable category and a warrantable one nobody's filled in
// yet is instead 'not_confirmed', so the two are never conflated.
export function getWarrantyState(purchase, settings = DEFAULT_SETTINGS) {
  const urgentWindowDays = settings.urgentWindowDays ?? DEFAULT_SETTINGS.urgentWindowDays
  if (!purchase.warrantyEligible) return 'none'
  if (!purchase.warrantyExpires) return 'not_confirmed'
  const daysLeft = daysUntil(purchase.warrantyExpires)
  if (daysLeft < 0) return 'expired'
  if (daysLeft <= urgentWindowDays) return 'expiring_soon'
  return 'active'
}

// A purchase's Protection Score: how much of the record ProofBack (or the
// user) has actually filled in, not a judgment of the item itself. Each
// check is something that materially helps a future return/warranty claim
// go through — missing ones are exactly what the "how to improve" hint on
// the detail page lists back to the user.
const PROTECTION_CHECKS = [
  { key: 'receipt', label: 'Receipt', met: (p) => (p.receiptImageUrls?.length || 0) > 0 || !!p.receiptImageUrl },
  { key: 'product', label: 'Product identified', met: (p) => !!(p.product && p.brand) },
  // A never-returnable category (Dining) or a non-warranty-eligible one has
  // nothing to "add" here — counting it as missing would tell the user to
  // fill in a field that can never apply, which is worse than not asking.
  { key: 'return_deadline', label: 'Return deadline', met: (p) => !!p.returnDeadline || p.category === 'Dining' },
  { key: 'warranty', label: 'Warranty', met: (p) => !!p.warrantyExpires || !p.warrantyEligible },
  { key: 'model_number', label: 'Model number', met: (p) => !!p.modelNumber },
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

// A single traffic-light read on a purchase — "needs_attention" always wins
// over "incomplete" (a closing deadline matters more right now than a
// missing serial number), and "protected" only once nothing else applies.
// Reuses the exact same signals as getAlerts/getProtectionScore rather than
// inventing a new completeness rule.
export function getReceiptHealth(purchase, settings = DEFAULT_SETTINGS) {
  const urgentWindowDays = settings.urgentWindowDays ?? DEFAULT_SETTINGS.urgentWindowDays
  const returnDaysLeft = daysUntil(purchase.returnDeadline)
  const warrantyDaysLeft = daysUntil(purchase.warrantyExpires)

  if (
    (returnDaysLeft !== null && returnDaysLeft > 0 && returnDaysLeft <= urgentWindowDays && purchase.returnStatus !== 'completed') ||
    (warrantyDaysLeft !== null && warrantyDaysLeft >= 0 && warrantyDaysLeft <= urgentWindowDays) ||
    refundOverdue(purchase)
  ) {
    const message = refundOverdue(purchase)
      ? 'A refund you were expecting is overdue.'
      : returnDaysLeft !== null && returnDaysLeft <= urgentWindowDays && returnDaysLeft > 0
        ? 'Your return deadline expires soon.'
        : 'Your warranty expires soon.'
    return { status: 'needs_attention', message }
  }

  const protection = getProtectionScore(purchase)
  if (protection.percent < 100) {
    const firstMissing = protection.checks.find((c) => !c.met)
    return {
      status: 'incomplete',
      message: firstMissing
        ? `Add your ${firstMissing.label.toLowerCase()} to improve protection.`
        : 'Some purchase information is missing.',
    }
  }

  return { status: 'protected', message: 'Your purchase information is complete.' }
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
      // Two identical-price items on the SAME receipt (e.g. two orders of
      // onion rings on one Whataburger ticket) are just what was ordered,
      // not a duplicate charge — that concern only makes sense across two
      // separate transactions.
      if (getReceiptGroupKey(a) === getReceiptGroupKey(b)) continue
      if (Math.abs((Number(a.price) || 0) - (Number(b.price) || 0)) > 0.01) continue
      const gap = daysBetween(a.purchaseDate, b.purchaseDate)
      if (gap === null || Math.abs(gap) > DUPLICATE_WINDOW_DAYS) continue
      flags.push({ id: `${a.id}-${b.id}-dup`, purchases: [a, b], amount: Number(a.price) || 0 })
    }
  }
  return flags
}

const TRANSACTION_MATCH_WINDOW_DAYS = 3

// Card -> Receipt Matching's core heuristic: no live bank connection exists
// (see ConnectedAccounts.jsx), so this only ever runs against a manually
// entered {store, amount, date} the user typed in to try the feature — same
// approximate, never-certain spirit as getDuplicatePurchaseFlags above.
export function matchTransactionToPurchase(transaction, purchases) {
  const store = (transaction.store || '').trim().toLowerCase()
  if (!store || transaction.amount == null) return null
  return (
    purchases.find((p) => {
      if (!p.store || p.store.trim().toLowerCase() !== store) return false
      if (Math.abs((Number(p.price) || 0) - Number(transaction.amount)) > 0.01) return false
      const gap = daysBetween(transaction.date, p.purchaseDate)
      return gap !== null && Math.abs(gap) <= TRANSACTION_MATCH_WINDOW_DAYS
    }) || null
  )
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
        confidence: p.returnDeadlineSource === 'receipt' || p.returnDeadlineSource === 'store_policy' ? 'high' : 'estimated',
        recommendedAction: 'Start the return with the merchant before the deadline.',
        submissionHistory: [],
        resolution: null,
      })

      if (['Apparel', 'Electronics', 'Home'].includes(p.category)) {
        cases.push({
          id: `${p.id}-case-exchange`,
          purchase: p,
          type: 'exchange',
          status: 'opportunity',
          amount: 0,
          eligibilityReason: 'Return window still open — most stores that accept a return will also exchange it',
          deadline: p.returnDeadline,
          requiredEvidence: ['Receipt'],
          evidenceProvided: (p.receiptImageUrls?.length || p.receiptImageUrl) ? ['Receipt'] : [],
          confidence: 'estimated',
          recommendedAction: 'Ask the merchant about an exchange instead of a return, if you\'d rather swap it.',
          submissionHistory: [],
          resolution: null,
        })
      }
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
        confidence: p.refund?.expectedAmount != null ? 'high' : 'estimated',
        recommendedAction: refundOverdue(p)
          ? 'Follow up with the merchant — this refund is now overdue.'
          : 'Keep an eye on this; follow up if it doesn\'t arrive by the expected date.',
        submissionHistory: [],
        resolution: null,
      })
    }

    if (p.isBusinessExpense) {
      cases.push({
        id: `${p.id}-case-reimbursement`,
        purchase: p,
        type: 'business_expense_reimbursement',
        status: 'opportunity',
        amount: Number(p.price) || 0,
        eligibilityReason: 'Marked as a business expense',
        deadline: null,
        requiredEvidence: ['Receipt'],
        evidenceProvided: (p.receiptImageUrls?.length || p.receiptImageUrl) ? ['Receipt'] : [],
        confidence: 'estimated',
        recommendedAction: 'Submit this receipt through your employer or client\'s own reimbursement process.',
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
      confidence: 'estimated',
      recommendedAction: 'Check your bank/card statement for an actual duplicate charge before disputing it.',
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

// The "Your Purchases" summary on Home: three at-a-glance groups, each
// built from data ProofBack actually has rather than anything invented —
// "needs attention" from real deadline/duplicate signals already computed
// elsewhere, "protected" as a plain documented-purchase count/value, and
// "potential savings" reusing getRecoverableTotal (real open return/refund/
// duplicate opportunities) rather than a fabricated price-drop figure.
export function getPurchaseProtectionSummary(purchases, settings = DEFAULT_SETTINGS) {
  const urgentWindowDays = settings.urgentWindowDays ?? DEFAULT_SETTINGS.urgentWindowDays

  const returnsExpiring = purchases.filter((p) => {
    const d = daysUntil(p.returnDeadline)
    return d !== null && d > 0 && d <= urgentWindowDays && p.returnStatus !== 'completed'
  }).length

  const warrantiesExpiring = purchases.filter((p) => getWarrantyState(p, settings) === 'expiring_soon').length

  const duplicatesFlagged = getDuplicatePurchaseFlags(purchases).length

  const totalValue = Math.round(purchases.reduce((sum, p) => sum + (Number(p.price) || 0), 0) * 100) / 100

  return {
    needsAttention: { returnsExpiring, warrantiesExpiring, duplicatesFlagged },
    protectedSummary: { count: purchases.length, totalValue },
    potentialSavings: getRecoverableTotal(purchases, settings),
  }
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
    if (returnDays !== null && returnDays > 0 && p.returnStatus !== 'completed' && notifications.returnDeadlines) {
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
// notification) — a return crosses in the moment it's within any threshold
// in RETURN_ALERT_THRESHOLDS; a warranty (or its registration deadline)
// crosses in within the user's configurable warrantyReminderDays. Both
// gated by the same per-category notification toggles as getNeedsAttention.
export function getAlerts(purchases, settings = DEFAULT_SETTINGS) {
  const notifications = settings.notifications ?? DEFAULT_SETTINGS.notifications
  const alerts = []

  purchases.forEach((p) => {
    const daysLeft = daysUntil(p.returnDeadline)
    if (daysLeft !== null && daysLeft > 0 && notifications.returnDeadlines) {
      const threshold = RETURN_ALERT_THRESHOLDS.find((t) => daysLeft <= t)
      if (threshold != null) {
        alerts.push({
          id: `${p.id}-alert-return`,
          purchase: p,
          type: 'return_deadline',
          urgent: daysLeft <= 3,
          daysLeft,
          message: `Your ${productLabel(p)} can still be returned for ${daysLeft} more day${daysLeft === 1 ? '' : 's'}.`,
        })
      }
    }

    const warrantyReminderDays = settings.warrantyReminderDays ?? DEFAULT_SETTINGS.warrantyReminderDays
    const warrantyDaysLeft = daysUntil(p.warrantyExpires)
    if (warrantyDaysLeft !== null && warrantyDaysLeft >= 0 && warrantyDaysLeft <= warrantyReminderDays && notifications.warrantyAlerts) {
      alerts.push({
        id: `${p.id}-alert-warranty`,
        purchase: p,
        type: 'warranty_expiring',
        urgent: warrantyDaysLeft <= 7,
        daysLeft: warrantyDaysLeft,
        message: `Your ${p.brand} warranty expires in ${warrantyDaysLeft} day${warrantyDaysLeft === 1 ? '' : 's'}.`,
      })
    }

    const registrationDaysLeft = daysUntil(p.warrantyRegistrationDeadline)
    if (registrationDaysLeft !== null && registrationDaysLeft >= 0 && registrationDaysLeft <= warrantyReminderDays && notifications.warrantyAlerts) {
      alerts.push({
        id: `${p.id}-alert-warranty-registration`,
        purchase: p,
        type: 'warranty_registration_deadline',
        urgent: registrationDaysLeft <= 7,
        daysLeft: registrationDaysLeft,
        message: `Register your ${p.brand} purchase for warranty coverage within ${registrationDaysLeft} day${registrationDaysLeft === 1 ? '' : 's'}.`,
      })
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
      const firstMissing = protection.checks.find((c) => !c.met)
      alerts.push({
        id: `${p.id}-alert-incomplete`,
        purchase: p,
        type: 'incomplete',
        urgent: false,
        daysLeft: null,
        message: firstMissing
          ? `Your ${productLabel(p)} is missing a ${firstMissing.label.toLowerCase()}. Add it to improve protection.`
          : `Your protection information for ${productLabel(p)} is incomplete.`,
      })
    }

    // Real, but dormant: nothing populates purchase.priceWatch yet (see
    // getPriceWatchItem below — no live price source is connected), so this
    // never actually fires today. It's wired up correctly for the moment
    // one is, rather than needing this added later.
    if (p.priceWatch?.status === 'dropped' && p.priceWatch.currentPrice != null) {
      alerts.push({
        id: `${p.id}-alert-price-drop`,
        purchase: p,
        type: 'price_drop',
        urgent: false,
        daysLeft: null,
        message: `The price on your ${productLabel(p)} dropped to ${formatMoney(p.priceWatch.currentPrice)} — you could save ${formatMoney(p.price - p.priceWatch.currentPrice)}.`,
      })
    }
  })

  return alerts.sort((a, b) => (a.daysLeft ?? 999) - (b.daysLeft ?? 999))
}

// ---------- Price Watch ----------
// Auto-tracks eligible purchases (real, from data already captured on
// every scan). Current price / history / store comparison / drop status
// all read from an optional purchase.priceWatch — nothing writes that yet
// since no live price-comparison source is connected (see the Price Watch
// plan). Until something does, every one of those fields honestly reads as
// "not checked" rather than showing an invented number — never claim a
// price is lower unless it can actually be verified.
const PRICE_WATCH_EXCLUDED_CATEGORIES = new Set(['Dining', 'Grocery'])

export function isPriceWatchEligible(purchase) {
  return !PRICE_WATCH_EXCLUDED_CATEGORIES.has(purchase.category)
}

export function getPriceWatchItem(purchase) {
  const pw = purchase.priceWatch
  if (!pw) {
    return {
      purchase,
      status: 'not_checked',
      currentPrice: null,
      checkedAt: null,
      lowestFound: null,
      highestFound: null,
      history: [],
      comparisons: [],
      potentialSavings: 0,
    }
  }
  const comparisons = Array.isArray(pw.comparisons) ? pw.comparisons : []
  // Whichever real signal shows the bigger honest opportunity — a tracked
  // price drop on the same item, or a verified cheaper price at another
  // store — so this number never contradicts a Best Deal callout sitting
  // right next to it on the same page.
  const dropSavings = pw.currentPrice != null && pw.currentPrice < purchase.price ? purchase.price - pw.currentPrice : 0
  const bestComparisonPrice = comparisons.filter((c) => c.verified && c.price < purchase.price).map((c) => c.price)
  const comparisonSavings = bestComparisonPrice.length ? purchase.price - Math.min(...bestComparisonPrice) : 0
  const potentialSavings = Math.round(Math.max(dropSavings, comparisonSavings) * 100) / 100
  return {
    purchase,
    status: pw.status || 'not_checked',
    currentPrice: pw.currentPrice ?? null,
    checkedAt: pw.checkedAt ?? null,
    lowestFound: pw.lowestFound ?? null,
    highestFound: pw.highestFound ?? null,
    history: Array.isArray(pw.history) ? pw.history : [],
    comparisons,
    potentialSavings,
  }
}

export function getPriceWatchItems(purchases) {
  return [...purchases]
    .filter(isPriceWatchEligible)
    .sort((a, b) => (a.purchaseDate < b.purchaseDate ? 1 : -1))
    .map(getPriceWatchItem)
}

export function getPriceWatchSummary(items) {
  const potentialSavings = Math.round(items.reduce((sum, i) => sum + i.potentialSavings, 0) * 100) / 100
  const priceDrops = items.filter((i) => i.status === 'dropped').length
  const lowerPricesFound = items.filter((i) => i.status === 'lower_found').length
  return { potentialSavings, trackedCount: items.length, priceDrops, lowerPricesFound }
}

// Everything the Purchase Dashboard's stat tiles need, computed once over
// the full purchases array so the Home screen stays a thin rendering layer.
export function getDashboardStats(purchases, settings = DEFAULT_SETTINGS) {
  const totalPurchases = purchases.length
  const totalSpent = Math.round(purchases.reduce((sum, p) => sum + (Number(p.price) || 0), 0) * 100) / 100
  const eligibleForReturn = purchases.filter((p) => returnIsOpen(p) && p.returnStatus !== 'completed').length
  const upcomingReturnDeadlines = purchases.filter((p) => {
    const d = daysUntil(p.returnDeadline)
    return d !== null && d > 0 && d <= 30 && p.returnStatus !== 'completed'
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
    if (daysLeft !== null && daysLeft > 0 && daysLeft <= urgentWindowDays && notifications.returnDeadlines) {
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

// Items saved from the same scan (or the same manual entry) share a
// `receiptGroupId` stamped at save time — that's the real signal that they
// came from "the same place" in the sense the user means (one transaction),
// as opposed to two separate visits to the same store. Purchases saved
// before this existed don't have it, so fall back to the next-best signal
// that's actually specific to one transaction (a receipt number, or the
// exact set of receipt photos) rather than just store+date, which two
// unrelated same-day purchases could share. With neither signal, a purchase
// never gets merged with anything — better to show it on its own than to
// wrongly combine two unrelated purchases.
// A short, deterministic fingerprint — receiptImageUrls are base64 data
// URIs (the app stores cropped receipt photos inline, not as hosted URLs),
// so joining them directly into a key would embed the entire image in
// anything that key touches (a route path, a link href) — hundreds of KB
// per photo. Collisions are effectively irrelevant here: worst case, two
// truly different receipts with byte-identical photos show as one group.
function fingerprint(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0
  }
  return (hash >>> 0).toString(36)
}

export function getReceiptGroupKey(p) {
  if (p.receiptGroupId) return p.receiptGroupId
  if (p.receiptNumber) return `legacy:${p.store || ''}|${p.purchaseDate || ''}|num:${p.receiptNumber}`
  if (p.receiptImageUrls?.length) {
    return `legacy:${p.store || ''}|${p.purchaseDate || ''}|imgs:${fingerprint(p.receiptImageUrls.join(','))}`
  }
  return `single:${p.id}`
}

// Rolls a flat purchase list up into one row per receipt/transaction —
// the "combine receipts from the same place" grouping, usable anywhere a
// screen lists purchases. Groups of one are still returned (so callers
// don't need a separate ungrouped path), just with itemCount 1.
export function groupByReceipt(purchases) {
  const byKey = new Map()
  purchases.forEach((p) => {
    const key = getReceiptGroupKey(p)
    if (!byKey.has(key)) {
      byKey.set(key, {
        key,
        store: p.store,
        purchaseDate: p.purchaseDate,
        receiptImageUrls: p.receiptImageUrls || [],
        purchases: [],
      })
    }
    byKey.get(key).purchases.push(p)
  })
  return [...byKey.values()]
    .map((g) => ({
      ...g,
      itemCount: g.purchases.length,
      totalPrice: Math.round(g.purchases.reduce((sum, p) => sum + (Number(p.price) || 0), 0) * 100) / 100,
    }))
    .sort((a, b) => (a.purchaseDate < b.purchaseDate ? 1 : -1))
}

// Same idea as groupByReceipt, but for recovery cases (Home's list) rather
// than raw purchases — cases are already one-per-purchase, so this merges
// the ones whose purchases belong to the same receipt into a single
// combined row, summing amounts and keeping the earliest deadline (the one
// that actually governs when action is needed).
export function groupCasesByReceipt(cases) {
  const byKey = new Map()
  cases.forEach((c) => {
    const key = getReceiptGroupKey(c.purchase)
    if (!byKey.has(key)) {
      byKey.set(key, { key, store: c.purchase.store, purchaseDate: c.purchase.purchaseDate, cases: [] })
    }
    byKey.get(key).cases.push(c)
  })
  return [...byKey.values()].map((g) => {
    const deadlines = g.cases.map((c) => c.deadline).filter(Boolean).sort()
    // itemCount is unique purchases, not case count — a duplicate_purchase
    // case references two purchases without itself being a distinct item,
    // so counting cases directly would overstate how many things are on
    // the receipt.
    const itemCount = new Set(g.cases.map((c) => c.purchase.id)).size
    return {
      ...g,
      itemCount,
      opportunityCount: g.cases.length,
      totalAmount: Math.round(g.cases.reduce((sum, c) => sum + (Number(c.amount) || 0), 0) * 100) / 100,
      deadline: deadlines[0] || null,
    }
  })
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
  Dining: '#D6604A',
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
    if (daysLeft !== null && daysLeft > 0 && daysLeft <= reminderWindowDays && notifications.returnDeadlines) {
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

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
]

// "Find My Purchase": a plain-English query parsed against ONLY what's
// actually in the user's own data (real store names, real category names
// already used in their purchases) — never a guessed category/store that
// doesn't exist, and never a server round-trip. Returns a structured filter
// the caller (Purchases.jsx) applies deterministically, plus `sumMode` when
// the query reads like "how much did I spend..." rather than "show me...".
export function parseSearchQuery(query, purchases) {
  const q = (query || '').toLowerCase().trim()
  if (!q) return null

  const filter = { keyword: null, store: null, category: null, dateFrom: null, dateTo: null, returnOpenOnly: false, sumMode: false }

  const knownStores = [...new Set(purchases.map((p) => p.store).filter(Boolean))]
  const matchedStore = knownStores.find((s) => q.includes(s.toLowerCase()))
  if (matchedStore) filter.store = matchedStore

  const knownCategories = [...new Set(purchases.map((p) => p.category).filter(Boolean))]
  const matchedCategory = knownCategories.find((c) => q.includes(c.toLowerCase()))
  if (matchedCategory) filter.category = matchedCategory

  const now = today()
  if (q.includes('this year')) {
    filter.dateFrom = `${now.getFullYear()}-01-01`
    filter.dateTo = `${now.getFullYear()}-12-31`
  } else if (q.includes('this month')) {
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    filter.dateFrom = `${y}-${m}-01`
    filter.dateTo = `${y}-${m}-31`
  } else {
    const monthIndex = MONTH_NAMES.findIndex((name) => q.includes(name))
    if (monthIndex !== -1) {
      const y = now.getFullYear()
      const m = String(monthIndex + 1).padStart(2, '0')
      filter.dateFrom = `${y}-${m}-01`
      filter.dateTo = `${y}-${m}-31`
    }
  }

  if (q.includes('return window') || q.includes('still returnable') || q.includes('within the return')) {
    filter.returnOpenOnly = true
  }

  if (q.includes('how much') || q.includes('spent') || q.includes('spend')) {
    filter.sumMode = true
  }

  // Whatever's left after stripping the recognized store/category/date
  // phrases still gets used as a plain keyword, so a query like "find my
  // nike shoes" keeps matching "nike shoes" the same way today's search
  // already does. Word-boundary matching matters here — a naive substring
  // replace of the stopword "i" would also delete the "i" out of "Nike",
  // turning it into "n ke" and breaking that exact match.
  let remainder = q
  ;[matchedStore, matchedCategory, 'this year', 'this month', 'return window', 'still returnable', 'how much', 'spent', 'spend', 'find', 'my', 'show', 'me', 'purchases', 'everything', 'i', 'bought', 'at', 'on', 'from', 'did'].forEach((phrase) => {
    if (!phrase) return
    const escaped = phrase.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    remainder = remainder.replace(new RegExp(`\\b${escaped}\\b`, 'g'), ' ')
  })
  remainder = remainder.replace(/[?.!]/g, ' ').replace(/\s+/g, ' ').trim()
  if (remainder) filter.keyword = remainder

  return filter
}

// Applies a parseSearchQuery() filter to a purchase list — pure and
// deterministic, no fuzziness beyond what parseSearchQuery already decided.
export function applySearchFilter(purchases, filter) {
  if (!filter) return purchases
  return purchases.filter((p) => {
    if (filter.store && p.store !== filter.store) return false
    if (filter.category && p.category !== filter.category) return false
    if (filter.dateFrom && (!p.purchaseDate || p.purchaseDate < filter.dateFrom)) return false
    if (filter.dateTo && (!p.purchaseDate || p.purchaseDate > filter.dateTo)) return false
    if (filter.returnOpenOnly && !returnIsOpen(p)) return false
    if (filter.keyword) {
      const hay = [p.product, p.brand, p.store, p.category, p.notes].filter(Boolean).join(' ').toLowerCase()
      // Each remaining word has to show up somewhere (order-independent) —
      // a leftover multi-word phrase like "nike shoes" shouldn't require
      // "nike" and "shoes" to sit adjacent in the product name, since a
      // real record is more likely "Nike Air Max" (brand "Nike") than a
      // product literally named "Nike shoes".
      const words = filter.keyword.split(/\s+/).filter(Boolean)
      if (!words.every((w) => hay.includes(w))) return false
    }
    return true
  })
}

// Price Finder's search: ProofBack has no external product catalog to
// search against (see the Price Finder plan), so "searching for a
// product" can only ever mean searching the purchases already on this
// account — real data, no fabricated matches. Same order-independent
// word matching as applySearchFilter's keyword branch above.
export function searchPurchasesForPriceFinder(query, purchases) {
  const words = (query || '').toLowerCase().trim().split(/\s+/).filter(Boolean)
  if (!words.length) return []
  return purchases
    .filter((p) => {
      const hay = [p.product, p.brand, p.modelNumber, p.orderNumber].filter(Boolean).join(' ').toLowerCase()
      return words.every((w) => hay.includes(w))
    })
    .sort((a, b) => (a.purchaseDate < b.purchaseDate ? 1 : -1))
}
