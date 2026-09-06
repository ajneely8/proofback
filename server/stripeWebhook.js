/**
 * Handles Stripe webhook events — the only reliable way to know a payment
 * actually succeeded (or a subscription actually ended), since the browser
 * redirect back from Checkout isn't trustworthy on its own (anyone could
 * hit the success_url directly without ever paying). Verifies the event
 * came from Stripe using the raw request body and STRIPE_WEBHOOK_SECRET
 * before acting on anything in it.
 */
import { getStripe } from './stripeClient.js'
import { getSupabaseAdmin } from './supabaseAdmin.js'

async function setPlan(userId, plan) {
  const admin = getSupabaseAdmin()
  if (!admin || !userId) return
  const { data: row } = await admin.from('user_settings').select('data').eq('user_id', userId).maybeSingle()
  const data = { ...(row?.data || {}), plan }
  await admin.from('user_settings').upsert({ user_id: userId, data, updated_at: new Date().toISOString() })
}

/** rawBody must be the unparsed request body (a Buffer or string) — signature verification fails on parsed JSON. */
export async function handleStripeWebhook(rawBody, signature) {
  const stripe = getStripe()
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!stripe || !webhookSecret) return { status: 400, body: { error: 'stripe_not_configured' } }

  let event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (err) {
    console.error('stripe webhook signature verification failed:', err.message)
    return { status: 400, body: { error: 'invalid_signature' } }
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object
      await setPlan(session.client_reference_id, 'premium')
      break
    }
    case 'customer.subscription.deleted': {
      // The Subscription object (not the original Checkout Session) is
      // all this event carries, so the user id has to live in its own
      // metadata — set via subscription_data.metadata when the checkout
      // session was created.
      const userId = event.data.object.metadata?.userId
      if (userId) await setPlan(userId, 'free')
      break
    }
    default:
      break
  }

  return { status: 200, body: { received: true } }
}
