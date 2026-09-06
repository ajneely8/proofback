import { getSupabaseAdmin } from './supabaseAdmin.js'

// Free plan cap: total purchases on the account (not scans-per-month — one
// scan can create several purchase records, one per line item, so what
// actually matters to the user is how many purchases they're tracking).
// 'pro'/'family' plans lift this cap entirely.
export const FREE_PURCHASE_LIMIT = 10

/**
 * Returns { allowed, remaining } without changing anything — used to reject
 * a scan before spending any Anthropic API usage on it. Fails open
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
  if (settingsRow?.data?.plan && settingsRow.data.plan !== 'free') return { allowed: true, remaining: null }

  const { count } = await admin
    .from('purchases')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  const used = count || 0
  return { allowed: used < FREE_PURCHASE_LIMIT, remaining: Math.max(0, FREE_PURCHASE_LIMIT - used) }
}

/**
 * No-op now that the cap is based on the purchases table itself rather than
 * a separate monthly counter — kept so existing call sites (after a
 * successful scan) don't need to change.
 */
export async function recordScanUsed() {}
