/**
 * Local dev server — runs alongside Vite (`npm run dev`) so /api/* has
 * something to proxy to. The actual logic for each route lives in its own
 * module, shared with the matching function under /api/*.js (what Vercel
 * actually runs in production, since a Vercel deployment never runs this
 * file at all).
 */
import express from 'express'
import { scanReceipt, scanReceiptWarnings } from './scanReceipt.js'
import { checkRecall } from './checkRecall.js'
import { searchProductPrices, getProductLink } from './priceFinder.js'
import { getAuthedUser, isAuthConfigured } from './auth.js'
import { checkScanAllowed, recordScanUsed, FREE_PURCHASE_LIMIT } from './scanLimit.js'

const PORT = Number(process.env.SCAN_PORT || 8789)

const app = express()

app.use(express.json({ limit: '15mb' }))

app.post('/api/scan-receipt', async (req, res) => {
  let userId = null
  // A visitor with no session at all is allowed through anonymously (their
  // free-scan limit is enforced client-side, see src/App.jsx) — only an
  // Authorization header that was actually sent but didn't resolve to a
  // real user (an expired/broken session) is rejected outright.
  if (isAuthConfigured() && req.headers.authorization) {
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

app.post('/api/check-recall', async (req, res) => {
  if (isAuthConfigured()) {
    const user = await getAuthedUser(req.headers.authorization)
    if (!user) {
      res.status(401).json({ error: 'unauthorized' })
      return
    }
  }
  const result = await checkRecall(req.body?.query)
  res.status(200).json(result)
})

app.post('/api/price-finder-search', async (req, res) => {
  // Anonymous visitors (using their free-scan trial, see src/App.jsx) can
  // use Price Finder too — only reject a request that sent a broken/expired
  // token, same pattern as /api/scan-receipt, not simply because none was
  // sent.
  if (isAuthConfigured() && req.headers.authorization) {
    const user = await getAuthedUser(req.headers.authorization)
    if (!user) {
      res.status(401).json({ error: 'unauthorized' })
      return
    }
  }
  const result = await searchProductPrices(req.body?.query)
  res.status(200).json(result)
})

app.post('/api/price-finder-product-link', async (req, res) => {
  // Same anonymous-visitor pattern as /api/price-finder-search above.
  if (isAuthConfigured() && req.headers.authorization) {
    const user = await getAuthedUser(req.headers.authorization)
    if (!user) {
      res.status(401).json({ error: 'unauthorized' })
      return
    }
  }
  const result = await getProductLink(req.body?.pageToken, req.body?.store)
  res.status(200).json(result)
})

app.listen(PORT, () => {
  const warnings = scanReceiptWarnings()
  console.log(`ProofBack scan service listening on :${PORT}${warnings.length ? ' (' + warnings.join('; ') + ')' : ''}`)
})
