/**
 * Vercel serverless function serving /api/check-recall in production — see
 * api/scan-receipt.js for why this file needs to exist at all (Vercel never
 * runs server/index.js). No API key required; CPSC's recall API is public.
 */
import { checkRecall } from '../server/checkRecall.js'
import { getAuthedUser, isAuthConfigured } from '../server/auth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' })
    return
  }

  if (isAuthConfigured()) {
    const user = await getAuthedUser(req.headers.authorization)
    if (!user) {
      res.status(401).json({ error: 'unauthorized' })
      return
    }
  }

  const result = await checkRecall(req.body?.query)
  res.status(200).json(result)
}
