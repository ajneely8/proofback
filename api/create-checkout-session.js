/**
 * Creates a Stripe Checkout session for the logged-in user to subscribe to
 * Premium, and returns its URL for the client to redirect to. Stripe hosts
 * the actual payment page — card details never pass through this app or
 * its server, which is the point: it keeps this codebase out of PCI scope
 * entirely rather than us handling card numbers ourselves.
 */
import { isStripeConfigured } from '../server/stripeClient.js'
import { getAuthedUser, isAuthConfigured } from '../server/auth.js'
import { createCheckoutSession } from '../server/checkoutSession.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' })
    return
  }

  if (!isAuthConfigured()) {
    res.status(400).json({ error: 'accounts_not_configured' })
    return
  }
  const user = await getAuthedUser(req.headers.authorization)
  if (!user) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }

  if (!isStripeConfigured()) {
    res.status(400).json({ error: 'stripe_not_configured' })
    return
  }

  const origin = req.headers.origin || `https://${req.headers.host}`
  try {
    const url = await createCheckoutSession({ userId: user.id, email: user.email, origin })
    res.status(200).json({ url })
  } catch (err) {
    console.error('create-checkout-session failed:', err.message, {
      type: err.type,
      code: err.code,
      cause: err.cause?.message || err.cause,
      raw: err.raw?.message,
    })
    res.status(500).json({ error: 'checkout_failed' })
  }
}
