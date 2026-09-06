import dns from 'node:dns'
import Stripe from 'stripe'

// Node's default DNS resolution order can hand back an IPv6 address that
// Vercel's serverless runtime can't actually route, which surfaces as a
// generic "An error occurred with our connection to Stripe" — happens
// regardless of which HTTP client the Stripe SDK uses underneath, since it's
// a DNS/routing issue, not an HTTP one. Forcing IPv4 first fixes it.
dns.setDefaultResultOrder('ipv4first')

let client = null

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  if (!client) client = new Stripe(key)
  return client
}

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID)
}
