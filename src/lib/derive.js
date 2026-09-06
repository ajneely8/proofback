import { TODAY, DEFAULT_SETTINGS, RETURN_ALERT_THRESHOLDS, WARRANTY_ALERT_THRESHOLDS } from '../data/mockData.js'

// Parse a "YYYY-MM-DD" string as a local-midnight Date, avoiding the UTC
// interpretation `new Date(str)` uses (which shifts the displayed day in
// timezones behind UTC).
function parseLocalDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function daysUntil(dateStr) {
  if (!dateStr) return null
  const target = parseLocalDate(dateStr)
  const today = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate())
  const ms = target - today
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

export function priceDrop(purchase) {
  if (purchase.currentPrice == null) return 0
  const diff = purchase.price - purchase.currentPrice
  return diff > 0.009 ? Math.round(diff * 100) / 100 : 0
}

export function returnIsOpen(purchase) {
  const d = daysUntil(purchase.returnDeadline)
  return d !== null && d >= 0
}

export function refundMissing(purchase) {
  return purchase.refund?.status === 'expected_missing'
}

// A purchase's return/refund state, as however many of these are true at
// once — not a single exclusive status, since e.g. a price adjustment and a
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
  const drop = priceDrop(purchase)

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

  if (drop > 0 && !purchase.priceAdjustment) {
    statuses.push({ key: 'price_adjustment', label: 'Eligible for price adjustment', tone: 'good' })
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

    if (priceDrop(p) > 0 && !p.priceAdjustment && notifications.priceDrops) {
      alerts.push({
        id: `${p.id}-alert-price`,
        purchase: p,
        type: 'price_drop',
        urgent: false,
        daysLeft: null,
        message: `You may still be eligible to return or price-adjust this ${formatMoney(p.price)} purchase.`,
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
  const y = TODAY.getFullYear()
  const m = String(TODAY.getMonth() + 1).padStart(2, '0')
  const d = String(TODAY.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Money actually recovered, as confirmed by the user's own actions (marking
// a price adjustment applied, a refund received, or a return completed) —
// not the same as the "potential" amounts in getOpportunities, which are
// just things ProofBack noticed and hasn't been told the outcome of.
export function getSavingsEvents(purchases) {
  const events = []

  purchases.forEach((p) => {
    if (p.priceAdjustment) {
      events.push({
        id: `${p.id}-price-event`,
        purchase: p,
        date: p.priceAdjustment.claimedDate,
        amount: p.priceAdjustment.amount,
        label: 'Price adjustment applied',
      })
    }
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
// getSavingsEvents (which is a return/refund/price-adjustment the user
// confirmed after the fact): this already happened, right there on the
// receipt, so it's counted the moment a purchase is saved rather than
// waiting on any action.
export function getTotalDiscountSaved(purchases) {
  const total = purchases.reduce((sum, p) => sum + (Number(p.itemDiscount) || 0), 0)
  return Math.round(total * 100) / 100
}

// Opportunities: return deadlines closing soon, price drops worth acting on, missing refunds.
// `settings.notifications` gates each category off when the user has turned that alert type off in Profile;
// `settings.reminderWindowDays` controls how many days out a closing return deadline counts as one.
export function getOpportunities(purchases, settings = DEFAULT_SETTINGS) {
  const notifications = settings.notifications ?? DEFAULT_SETTINGS.notifications
  const urgentWindowDays = settings.urgentWindowDays ?? DEFAULT_SETTINGS.urgentWindowDays
  const opps = []

  purchases.forEach((p) => {
    const drop = priceDrop(p)
    if (drop > 0 && notifications.priceDrops) {
      opps.push({
        id: `${p.id}-price`,
        type: 'price_adjustment',
        amount: drop,
        title: 'Potential price adjustment',
        purchase: p,
        detail: productLabel(p),
        note: 'Current price is lower than your purchase price.',
        action: 'Review',
      })
    }

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
    const key = o.type === 'price_adjustment' ? o.id : `${o.purchase.id}-value`
    if (!seen.has(key)) {
      seen.add(key)
      total += o.type === 'price_adjustment' ? o.amount : o.type === 'refund_missing' ? o.amount : 0
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
  const today = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1)
  const buckets = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
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
    const drop = priceDrop(p)
    if (daysLeft !== null && daysLeft >= 0 && daysLeft <= reminderWindowDays && notifications.returnDeadlines) {
      items.push({
        id: `${p.id}-attn-return`,
        purchase: p,
        label: productLabel(p),
        primaryText: `Return deadline: ${formatDate(p.returnDeadline)}`,
        secondaryText: drop > 0 ? `Potential savings: ${formatMoney(drop)}` : null,
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
