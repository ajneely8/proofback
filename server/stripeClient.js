import Stripe from 'stripe'

let client = null

export function getStripe() {
  // A stray trailing newline or space in the env var value (easy to
  // introduce via copy-paste into a dashboard) makes Node reject the
  // Authorization header outright ("Invalid character in header content"),
  // which Stripe's SDK reports as a generic connection error with no useful
  // detail. Trimming avoids that class of bug entirely.
  const key = process.env.STRIPE_SECRET_KEY?.trim()
  if (!key) return null
  if (!client) client = new Stripe(key)
  return client
}

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID)
}

// STRIPE_PRICE_ID is the original single "Premium" price, kept as the Pro
// tier's price so nothing already configured in Vercel breaks. Family has
// its own separate price once/if it's created (STRIPE_PRICE_ID_FAMILY) —
// isTierConfigured(...) tells the UI whether to offer it yet.
export function priceIdForTier(tier) {
  if (tier === 'family') return process.env.STRIPE_PRICE_ID_FAMILY || null
  return process.env.STRIPE_PRICE_ID || null
}

export function isTierConfigured(tier) {
  return Boolean(process.env.STRIPE_SECRET_KEY && priceIdForTier(tier))
}
