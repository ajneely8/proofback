import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// null (not a throwing client) when the keys aren't configured yet, so the
// rest of the app can check `isSupabaseConfigured` and show a clear setup
// message instead of a blank crash — this matters right after deploy,
// before the env vars have been added.
export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase = isSupabaseConfigured ? createClient(url, anonKey) : null
