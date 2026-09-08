/**
 * Vercel serverless function serving /api/price-finder-search in
 * production — see api/scan-receipt.js for why this file needs to exist at
 * all (Vercel never runs server/index.js).
 *
 * Requires SERPAPI_API_KEY set in the Vercel project's Environment
 * Variables (Project Settings -> Environment Variables) — .env is
 * gitignored and never reaches the deployed build.
 */
import { searchProductPrices } from '../server/priceFinder.js'
import { getAuthedUser, isAuthConfigured } from '../server/auth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' })
    return
  }

  // Anonymous visitors (using their free-scan trial) can use Price Finder
  // too — only reject a request that sent a broken/expired token, same
  // pattern as api/scan-receipt.js, not simply because none was sent.
  if (isAuthConfigured() && req.headers.authorization) {
    const user = await getAuthedUser(req.headers.authorization)
    if (!user) {
      res.status(401).json({ error: 'unauthorized' })
      return
    }
  }

  const result = await searchProductPrices(req.body?.query)
  res.status(200).json(result)
}
