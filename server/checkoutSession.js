import { getStripe } from './stripeClient.js'

export async function createCheckoutSession({ userId, email, origin }) {
  const stripe = getStripe()
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
    client_reference_id: userId,
    customer_email: email,
    // client_reference_id only lives on the Session — propagating the user
    // id onto the Subscription itself too means a later
    // customer.subscription.deleted event (which only carries the
    // Subscription, not the original Session) can still identify whose
    // plan to downgrade.
    subscription_data: { metadata: { userId } },
    success_url: `${origin}/profile?checkout=success`,
    cancel_url: `${origin}/profile?checkout=cancelled`,
  })
  return session.url
}
