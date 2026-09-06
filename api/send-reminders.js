/**
 * Triggered daily by Vercel Cron (see vercel.json). Vercel signs cron
 * requests with an Authorization: Bearer <CRON_SECRET> header matching the
 * CRON_SECRET env var, which this checks so the endpoint can't be spammed
 * by anyone who finds the URL — sending email costs money and a random
 * trigger would email every Premium user early/repeatedly.
 */
import { sendReminderDigests } from '../server/emailReminders.js'

export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }

  const result = await sendReminderDigests()
  res.status(200).json(result)
}
