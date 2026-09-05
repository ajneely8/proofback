/**
 * Local dev server for receipt scanning — runs alongside Vite (`npm run
 * dev`) so `/api/scan-receipt` has something to proxy to. The actual scan
 * logic lives in scanReceipt.js, shared with api/scan-receipt.js (the
 * Vercel serverless function that serves this route in production, since a
 * Vercel deployment never runs this file at all).
 */
import express from 'express'
import { scanReceipt, scanReceiptWarnings } from './scanReceipt.js'
import { getAuthedUser, isAuthConfigured } from './auth.js'

const PORT = Number(process.env.SCAN_PORT || 8789)

const app = express()
app.use(express.json({ limit: '15mb' }))

app.post('/api/scan-receipt', async (req, res) => {
  if (isAuthConfigured()) {
    const user = await getAuthedUser(req.headers.authorization)
    if (!user) {
      res.status(401).json({ error: 'unauthorized' })
      return
    }
  }
  const { status, body } = await scanReceipt(req.body)
  res.status(status).json(body)
})

app.listen(PORT, () => {
  const warnings = scanReceiptWarnings()
  console.log(`ProofBack scan service listening on :${PORT}${warnings.length ? ' (' + warnings.join('; ') + ')' : ''}`)
})
