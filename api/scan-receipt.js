/**
 * Vercel serverless function serving /api/scan-receipt in production.
 * A Vercel deployment only builds and serves the static Vite frontend — it
 * never runs server/index.js (that's an Express process for local dev only)
 * — so without this file the app has no scan endpoint at all once deployed.
 * Any file under /api is auto-deployed by Vercel as its own function; the
 * actual logic lives in server/scanReceipt.js so this host and the local
 * Express one can't drift apart.
 *
 * Requires ANTHROPIC_API_KEY set in the Vercel project's Environment
 * Variables (Project Settings -> Environment Variables) — .env is
 * gitignored and never reaches the deployed build.
 */
import { scanReceipt } from '../server/scanReceipt.js'
import { getAuthedUser, isAuthConfigured } from '../server/auth.js'
import { checkScanAllowed, recordScanUsed, FREE_SCAN_LIMIT } from '../server/scanLimit.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' })
    return
  }

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
      res.status(403).json({ error: 'scan_limit_reached', limit: FREE_SCAN_LIMIT })
      return
    }
  }

  const { status, body } = await scanReceipt(req.body)
  if (userId && status === 200) await recordScanUsed(userId)
  res.status(status).json(body)
}
