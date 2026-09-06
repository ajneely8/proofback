import { getSupabaseAdmin } from './supabaseAdmin.js'

// There's no real billing wired up yet — "premium" is a manually-set flag
// (Profile -> Appearance area) standing in for a subscription until Stripe
// (or similar) is actually connected. This is the number that flag exists
// to lift.
export const FREE_SCAN_LIMIT = 5

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Returns { allowed, remaining } without incrementing anything — used to
 * reject a scan before spending any Anthropic API usage on it. Fails open
 * (allowed: true) if the service role key isn't configured, or if the
 * user's plan can't be read, rather than blocking scanning over an
 * unrelated setup gap.
 */
export async function checkScanAllowed(userId) {
  const admin = getSupabaseAdmin()
  if (!admin) return { allowed: true, remaining: null }

  const { data: settingsRow } = await admin
    .from('user_settings')
    .select('data')
    .eq('user_id', userId)
    .maybeSingle()
  if (settingsRow?.data?.plan === 'premium') return { allowed: true, remaining: null }

  const month = currentMonth()
  const { data: usageRow } = await admin
    .from('scan_usage')
    .select('count')
    .eq('user_id', userId)
    .eq('month', month)
    .maybeSingle()
  const used = usageRow?.count || 0
  return { allowed: used < FREE_SCAN_LIMIT, remaining: Math.max(0, FREE_SCAN_LIMIT - used) }
}

/** Called only after a scan actually succeeds — a failed scan shouldn't count against the limit. */
export async function recordScanUsed(userId) {
  const admin = getSupabaseAdmin()
  if (!admin) return
  const month = currentMonth()
  const { data: usageRow } = await admin
    .from('scan_usage')
    .select('count')
    .eq('user_id', userId)
    .eq('month', month)
    .maybeSingle()
  await admin.from('scan_usage').upsert({ user_id: userId, month, count: (usageRow?.count || 0) + 1 })
}
