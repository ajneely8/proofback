/**
 * Local dev server — runs alongside Vite (`npm run dev`) so /api/* has
 * something to proxy to. The actual logic for each route lives in its own
 * module, shared with the matching function under /api/*.js (what Vercel
 * actually runs in production, since a Vercel deployment never runs this
 * file at all).
 */
import express from 'express'
import { scanReceipt, scanReceiptWarnings } from './scanReceipt.js'
import { getAuthedUser, isAuthConfigured } from './auth.js'
import { checkScanAllowed, recordScanUsed, FREE_PURCHASE_LIMIT } from './scanLimit.js'
import { isTierConfigured } from './stripeClient.js'
import { handleStripeWebhook } from './stripeWebhook.js'
import { createCheckoutSession } from './checkoutSession.js'

const PORT = Number(process.env.SCAN_PORT || 8789)

const app = express()

// Registered before express.json() below: Stripe signature verification
// needs the exact raw request bytes, and once the JSON parser has consumed
// the body stream for a request, nothing downstream can read it raw again.
app.post('/api/stripe-webhook', express.raw({ type: '*/*' }), async (req, res) => {
  const { status, body } = await handleStripeWebhook(req.body, req.headers['stripe-signature'])
  res.status(status).json(body)
})

app.use(express.json({ limit: '15mb' }))

app.post('/api/scan-receipt', async (req, res) => {
  let userId = null
  if (isAuthConfigured()) {
    const user = await getAuthedUser(req.headers.authorization)
    if (!user) {
      res.status(401).json({ error: 'unauthorized' })
      return
    }
    userId = user.id

    const { allowed } = await checkScanAllowed(userId)
    if (!allowed) {
      res.status(403).json({ error: 'scan_limit_reached', limit: FREE_PURCHASE_LIMIT })
      return
    }
  }
  const { status, body } = await scanReceipt(req.body)
  if (userId && status === 200) await recordScanUsed(userId)
  res.status(status).json(body)
})

app.post('/api/create-checkout-session', async (req, res) => {
  if (!isAuthConfigured()) {
    res.status(400).json({ error: 'accounts_not_configured' })
    return
  }
  const user = await getAuthedUser(req.headers.authorization)
  if (!user) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }
  const tier = req.body?.tier === 'family' ? 'family' : 'pro'
  if (!isTierConfigured(tier)) {
    res.status(400).json({ error: 'stripe_not_configured' })
    return
  }

  const origin = req.headers.origin || `http://localhost:5220`
  try {
    const url = await createCheckoutSession({ userId: user.id, email: user.email, origin, tier })
    res.status(200).json({ url })
  } catch (err) {
    console.error('create-checkout-session failed:', err.message)
    res.status(500).json({ error: 'checkout_failed' })
  }
})

app.listen(PORT, () => {
  const warnings = scanReceiptWarnings()
  console.log(`ProofBack scan service listening on :${PORT}${warnings.length ? ' (' + warnings.join('; ') + ')' : ''}`)
})
