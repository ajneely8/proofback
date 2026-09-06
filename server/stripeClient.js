import Stripe from 'stripe'

let client = null

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  // Stripe's default HTTP client uses Node's https agent, which can fail to
  // connect inside Vercel's serverless runtime ("An error occurred with our
  // connection to Stripe"). Using fetch instead avoids that.
  if (!client) client = new Stripe(key, { httpClient: Stripe.createFetchHttpClient() })
  return client
}

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID)
}
