// ProofBack is fully free for now (no paid tiers, no Stripe) — kept as its
// own module, with the same exports call sites already expect, rather than
// stripping the scan-limit check out of every route that called it. Once a
// payment system comes back (Apple IAP, Stripe, or both), the actual
// per-plan logic (the previous version of this file, still in git history)
// slots back in here without touching api/scan-receipt.js or server/index.js.
export const FREE_PURCHASE_LIMIT = Infinity

export async function checkScanAllowed() {
  return { allowed: true, remaining: null }
}

/**
 * No-op now that the cap is based on the purchases table itself rather than
 * a separate monthly counter — kept so existing call sites (after a
 * successful scan) don't need to change.
 */
export async function recordScanUsed() {}
