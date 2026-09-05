import { formatDate, formatMoney, productLabel } from './derive.js'

function dataUrlToFile(dataUrl, filename) {
  const [header, base64] = dataUrl.split(',')
  const mime = header.match(/data:(.*);base64/)?.[1] || 'image/jpeg'
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new File([bytes], filename, { type: mime })
}

function summaryText(purchase) {
  const lines = [
    productLabel(purchase),
    `${purchase.store} · ${formatDate(purchase.purchaseDate)} · ${formatMoney(purchase.price)}`,
  ]
  if (purchase.receiptNumber) lines.push(`Receipt #${purchase.receiptNumber}`)
  if (purchase.returnDeadline) lines.push(`Return deadline: ${formatDate(purchase.returnDeadline)}`)
  if (purchase.warrantyExpires) lines.push(`Warranty expires: ${formatDate(purchase.warrantyExpires)}`)
  return lines.join('\n')
}

// Tries the device's native share sheet first (with the receipt photo
// attached, when the browser supports sharing files) so this can go
// straight into an email/message/warranty-claim form; falls back to
// copying the same details to the clipboard on browsers/desktops without
// share support, so the action still does something useful everywhere.
export async function sharePurchase(purchase) {
  const text = summaryText(purchase)
  const title = productLabel(purchase)
  const receiptDataUrl = purchase.receiptImageUrls?.[0] || purchase.receiptImageUrl || null

  if (navigator.share) {
    try {
      if (receiptDataUrl && navigator.canShare) {
        const file = dataUrlToFile(receiptDataUrl, 'receipt.jpg')
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ title, text, files: [file] })
          return 'shared'
        }
      }
      await navigator.share({ title, text })
      return 'shared'
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled'
      // Fall through to clipboard below if sharing itself failed.
    }
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return 'copied'
  }

  return 'unsupported'
}
