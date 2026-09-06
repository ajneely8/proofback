/**
 * Stripe signature verification needs the exact raw request bytes, not a
 * parsed object — bodyParser: false stops Vercel's default JSON parsing so
 * the handler below can read the untouched body itself.
 */
export const config = {
  api: {
    bodyParser: false,
  },
}

import { handleStripeWebhook } from '../server/stripeWebhook.js'

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' })
    return
  }

  const rawBody = await readRawBody(req)
  const { status, body } = await handleStripeWebhook(rawBody, req.headers['stripe-signature'])
  res.status(status).json(body)
}
