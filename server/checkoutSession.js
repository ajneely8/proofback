import { getStripe, priceIdForTier } from './stripeClient.js'

export async function createCheckoutSession({ userId, email, origin, tier = 'pro' }) {
  const stripe = getStripe()
  const priceId = priceIdForTier(tier)
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: userId,
    customer_email: email,
    metadata: { userId, plan: tier },
    // client_reference_id only lives on the Session — propagating the user
    // id (and which tier this is) onto the Subscription itself too means a
    // later customer.subscription.deleted event (which only carries the
    // Subscription, not the original Session) can still identify whose plan
    // to downgrade, and checkout.session.completed knows which plan to set.
    subscription_data: { metadata: { userId, plan: tier } },
    success_url: `${origin}/profile/subscription?checkout=success`,
    cancel_url: `${origin}/profile/subscription?checkout=cancelled`,
  })
  return session.url
}
