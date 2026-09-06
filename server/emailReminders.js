/**
 * Sends a daily digest email to Premium users with anything urgent — return
 * windows closing soon, warranties about to expire. Triggered by a Vercel
 * Cron job (see api/send-reminders.js and vercel.json), since this is the
 * one thing the on-open browser notification (src/lib/notify.js) genuinely
 * can't do: reach someone who hasn't opened the app.
 *
 * Deliberately uses real calendar dates (new Date()) rather than
 * src/lib/derive.js's day-math, which is built around a fixed TODAY
 * constant for this app's demo data — fine for the UI, wrong for a cron
 * that has to run on whatever day it actually is.
 */
import { getSupabaseAdmin } from './supabaseAdmin.js'

const DEFAULT_URGENT_WINDOW_DAYS = 7

function daysUntil(dateStr) {
  if (!dateStr) return null
  const [y, m, d] = dateStr.split('-').map(Number)
  const target = new Date(y, m - 1, d)
  const today = new Date()
  const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((target - todayLocal) / 86400000)
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function findUrgentItems(purchases, urgentWindowDays) {
  const items = []
  for (const p of purchases) {
    const returnDays = daysUntil(p.returnDeadline)
    if (returnDays !== null && returnDays >= 0 && returnDays <= urgentWindowDays && p.returnStatus !== 'completed') {
      items.push(`${p.brand} ${p.product} — return closes ${formatDate(p.returnDeadline)} (${returnDays}d)`)
    }
    const warrantyDays = daysUntil(p.warrantyExpires)
    if (warrantyDays !== null && warrantyDays >= 0 && warrantyDays <= urgentWindowDays) {
      items.push(`${p.brand} ${p.product} — warranty expires ${formatDate(p.warrantyExpires)} (${warrantyDays}d)`)
    }
  }
  return items
}

async function sendEmail(to, items) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL || 'ProofBack <onboarding@resend.dev>'
  if (!apiKey) return { sent: false, reason: 'no_resend_key' }

  const list = items.map((i) => `- ${i}`).join('\n')
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to,
      subject: `ProofBack: ${items.length} item${items.length === 1 ? '' : 's'} need${items.length === 1 ? 's' : ''} attention`,
      text: `Here's what's coming up:\n\n${list}\n\nOpen ProofBack to see details.`,
    }),
  })
  if (!res.ok) return { sent: false, reason: `resend_${res.status}` }
  return { sent: true }
}

export async function sendReminderDigests() {
  const admin = getSupabaseAdmin()
  if (!admin) return { sent: 0, skipped: 'not_configured' }
  if (!process.env.RESEND_API_KEY) return { sent: 0, skipped: 'no_resend_key' }

  const { data: usersPage, error: usersError } = await admin.auth.admin.listUsers()
  if (usersError) return { sent: 0, error: usersError.message }

  const { data: settingsRows } = await admin.from('user_settings').select('user_id, data')
  const premiumUserIds = new Set(
    (settingsRows || []).filter((r) => r.data?.plan === 'premium').map((r) => r.user_id)
  )
  const settingsByUser = Object.fromEntries((settingsRows || []).map((r) => [r.user_id, r.data]))

  let sent = 0
  const results = []
  for (const user of usersPage.users) {
    if (!premiumUserIds.has(user.id) || !user.email) continue

    const { data: purchaseRows } = await admin.from('purchases').select('data').eq('user_id', user.id)
    const purchases = (purchaseRows || []).map((r) => r.data)
    const urgentWindowDays = settingsByUser[user.id]?.urgentWindowDays ?? DEFAULT_URGENT_WINDOW_DAYS
    const items = findUrgentItems(purchases, urgentWindowDays)
    if (items.length === 0) continue

    const result = await sendEmail(user.email, items)
    if (result.sent) sent++
    results.push({ email: user.email, itemCount: items.length, ...result })
  }

  return { sent, checked: usersPage.users.length, results }
}
