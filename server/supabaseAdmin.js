/**
 * A Supabase client authenticated with the service role key, which bypasses
 * Row Level Security entirely. Only ever used server-side, for operations
 * no regular user's own login should be able to do themselves — writing to
 * scan_usage (so a user can't reset their own free-tier count) and, for the
 * reminder cron, reading across every user's purchases at once (which no
 * single user's session could do under RLS). Never import this from
 * anything that runs in the browser.
 */
import { createClient } from '@supabase/supabase-js'

let client = null

export function getSupabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  if (!client) client = createClient(url, serviceKey)
  return client
}
