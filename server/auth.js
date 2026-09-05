/**
 * Verifies the logged-in user making a request to the scan API, so a random
 * visitor who finds the URL can't rack up Anthropic API usage on this
 * project's key — only requests carrying a valid Supabase session token
 * (sent by the client as an Authorization: Bearer header) are allowed
 * through. Uses the same anon key as the client; verifying a token doesn't
 * require the (never-exposed) service role key.
 */
import { createClient } from '@supabase/supabase-js'

let client = null
function getClient() {
  const url = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null
  if (!client) client = createClient(url, anonKey)
  return client
}

// Accounts are opt-in until Supabase is configured — while that's true, the
// scan endpoint stays open exactly as it was before accounts existed,
// rather than 401ing every request because there's no login system to
// have logged into yet.
export function isAuthConfigured() {
  return getClient() !== null
}

export async function getAuthedUser(authHeader) {
  const supabase = getClient()
  if (!supabase || !authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice('Bearer '.length)
  const { data, error } = await supabase.auth.getUser(token)
  if (error) return null
  return data.user
}
