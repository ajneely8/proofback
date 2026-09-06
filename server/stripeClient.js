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
