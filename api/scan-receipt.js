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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' })
    return
  }

  const { status, body } = await scanReceipt(req.body)
  res.status(status).json(body)
}
