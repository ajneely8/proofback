import { TODAY, DEFAULT_SETTINGS } from '../data/mockData.js'

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

// Opportunities: return deadlines closing soon, price drops worth acting on, missing refunds.
// `notifications` gates each category off when the user has turned that alert type off in Profile.
export function getOpportunities(purchases, notifications = DEFAULT_SETTINGS.notifications) {
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
    if (daysLeft !== null && daysLeft >= 0 && daysLeft <= 10 && notifications.returnDeadlines) {
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

export function totalRecoverable(purchases, notifications = DEFAULT_SETTINGS.notifications) {
  const opps = getOpportunities(purchases, notifications)
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

export function getNeedsAttention(purchases, notifications = DEFAULT_SETTINGS.notifications) {
  const items = []

  purchases.forEach((p) => {
    const daysLeft = daysUntil(p.returnDeadline)
    const drop = priceDrop(p)
    if (daysLeft !== null && daysLeft >= 0 && daysLeft <= 30 && notifications.returnDeadlines) {
      items.push({
        id: `${p.id}-attn-return`,
        purchase: p,
        label: productLabel(p),
        primaryText: `Return deadline: ${formatDate(p.returnDeadline)}`,
        secondaryText: drop > 0 ? `Potential savings: ${formatMoney(drop)}` : null,
        urgent: daysLeft <= 7,
        daysLeft,
        windowDays: 30,
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
    if (warrantyDaysLeft !== null && warrantyDaysLeft >= 0 && warrantyDaysLeft <= 30 && notifications.warrantyAlerts) {
      items.push({
        id: `${p.id}-attn-warranty`,
        purchase: p,
        label: productLabel(p),
        primaryText: `Warranty expires: ${formatDate(p.warrantyExpires)}`,
        secondaryText: null,
        urgent: warrantyDaysLeft <= 7,
        daysLeft: warrantyDaysLeft,
        windowDays: 30,
      })
    }
  })

  return items
}
