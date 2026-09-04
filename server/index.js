/**
 * Receipt-scanning service.
 *
 * The Anthropic API key lives only here — the browser sends a photo and
 * gets back structured fields, never the key. Return-window and warranty
 * lengths are generic category defaults (not real per-retailer policy,
 * which nothing in this app has access to) so they're applied here rather
 * than trusted from the model. The product photo is looked up from a
 * description the model is required to ground in words actually printed
 * on the receipt (see imageQuery below) — never from the store name or an
 * order number, which produced unrelated photos before this existed.
 * It's first searched against the store's own site (findStoreImage) so it
 * has a real chance of being that retailer's actual product photo, falling
 * back to a generic stock photo (findStockImage) only when that search
 * can't find or reach the store's site.
 */
import express from 'express'
import Anthropic from '@anthropic-ai/sdk'

const PORT = Number(process.env.SCAN_PORT || 8789)
const API_KEY = process.env.ANTHROPIC_API_KEY || ''
const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY || ''
const GOOGLE_SEARCH_KEY = process.env.GOOGLE_SEARCH_API_KEY || ''
const GOOGLE_SEARCH_CX = process.env.GOOGLE_SEARCH_CX || ''

const anthropic = API_KEY ? new Anthropic({ apiKey: API_KEY }) : null

// Known store name -> domain, for restricting an image search to that
// retailer's own site. Not exhaustive — unlisted stores fall through to a
// same-pattern guess (spaces/punctuation stripped + ".com"), which is right
// often enough to be worth trying but isn't guaranteed.
const STORE_DOMAINS = {
  nike: 'nike.com',
  adidas: 'adidas.com',
  amazon: 'amazon.com',
  'best buy': 'bestbuy.com',
  target: 'target.com',
  walmart: 'walmart.com',
  costco: 'costco.com',
  'home depot': 'homedepot.com',
  lowes: 'lowes.com',
  "lowe's": 'lowes.com',
  apple: 'apple.com',
  samsung: 'samsung.com',
  'macys': 'macys.com',
  "macy's": 'macys.com',
  kohls: 'kohls.com',
  "kohl's": 'kohls.com',
  ikea: 'ikea.com',
  wayfair: 'wayfair.com',
  'fleet feet': 'fleetfeet.com',
  brooks: 'brooksrunning.com',
  fully: 'fully.com',
  rei: 'rei.com',
  'dicks sporting goods': 'dickssportinggoods.com',
  "dick's sporting goods": 'dickssportinggoods.com',
}

function guessStoreDomain(store) {
  if (!store) return null
  const key = store.trim().toLowerCase()
  if (STORE_DOMAINS[key]) return STORE_DOMAINS[key]
  const match = Object.keys(STORE_DOMAINS).find((name) => key.includes(name))
  if (match) return STORE_DOMAINS[match]
  const guess = key.replace(/[^a-z0-9]/g, '')
  return guess ? `${guess}.com` : null
}

/**
 * Looks up a photo actually hosted on the store's own site (via a
 * site-restricted Google image search), so the photo has a real chance of
 * being that retailer's own product shot rather than an unrelated stock
 * photo. Still not a guarantee of the exact item — it's whatever image best
 * matches a short text description on that domain, and stores that don't
 * publish product photos, or whose site the domain guess misses, will
 * return nothing. Returns null (never throws) so a lookup failure never
 * blocks saving the purchase.
 */
async function findStoreImage(store, query) {
  if (!GOOGLE_SEARCH_KEY || !GOOGLE_SEARCH_CX || !query) return null
  const domain = guessStoreDomain(store)
  if (!domain) return null
  try {
    const params = new URLSearchParams({
      key: GOOGLE_SEARCH_KEY,
      cx: GOOGLE_SEARCH_CX,
      q: query,
      searchType: 'image',
      num: '1',
      safe: 'active',
      siteSearch: domain,
      siteSearchFilter: 'i',
    })
    const res = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`)
    if (!res.ok) return null
    const data = await res.json()
    const item = data.items?.[0]
    if (!item?.link) return null
    return {
      url: item.link,
      sourcePage: item.image?.contextLink || `https://${domain}`,
      domain,
    }
  } catch {
    return null
  }
}

/**
 * A receipt line never carries a product photo, so absent a store-site
 * match this can only ever return a representative stock photo for a short
 * visual description drawn from what's actually printed on the receipt
 * (e.g. "red running shoes") — not the exact item, color, or model
 * purchased. Callers should treat it as decorative, not evidence. Returns
 * null (never throws) so a lookup failure can't block saving the purchase.
 */
async function findStockImage(query) {
  if (!UNSPLASH_KEY || !query) return null
  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&content_filter=high`,
      { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` } }
    )
    if (!res.ok) return null
    const data = await res.json()
    const photo = data.results?.[0]
    if (!photo) return null
    return {
      url: photo.urls.small,
      photographerName: photo.user?.name || 'Unknown',
      photographerUrl: photo.user?.links?.html || 'https://unsplash.com',
      downloadLocation: photo.links?.download_location || null,
    }
  } catch {
    return null
  }
}

const RETURN_WINDOW_DAYS = {
  Electronics: 15,
  Apparel: 30,
  Home: 30,
  Grocery: 7,
  Other: 30,
}

const WARRANTY_YEARS = {
  Electronics: 1,
  Home: 1,
  Apparel: 0,
  Grocery: 0,
  Other: 0,
}

function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d + days)
  return toISO(dt)
}

function addYears(dateStr, years) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y + years, m - 1, d)
  return toISO(dt)
}

function toISO(dt) {
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const d = String(dt.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const EXTRACT_TOOL = {
  name: 'record_receipt',
  description: 'Record the fields read off a purchase receipt photo.',
  input_schema: {
    type: 'object',
    properties: {
      found: {
        type: 'boolean',
        description: 'true if this image is a legible purchase receipt, false otherwise.',
      },
      reason: {
        type: 'string',
        description: 'If found is false, a short reason why (e.g. "blurry", "not a receipt").',
      },
      store: { type: 'string', description: 'Store or merchant name as printed on the receipt.' },
      product: {
        type: 'string',
        description:
          'The main item purchased. If there are several line items, name the most expensive one and mention "+N more" is not needed — just the single clearest item name.',
      },
      price: {
        type: 'number',
        description: 'Total amount paid, as printed (numeric, no currency symbol).',
      },
      purchaseDate: {
        type: 'string',
        description: 'Purchase date in YYYY-MM-DD format.',
      },
      purchaseTime: {
        type: 'string',
        description:
          'Time of purchase in 24-hour HH:MM format (e.g. "14:32"), exactly as printed on the receipt. Omit this field entirely if no time is printed.',
      },
      category: {
        type: 'string',
        enum: ['Electronics', 'Apparel', 'Home', 'Grocery', 'Other'],
        description: 'Best-guess category of the purchase.',
      },
      imageQuery: {
        type: 'string',
        description:
          'A short 2-5 word visual description of the item, built ONLY from words that actually describe what it looks like on the receipt (e.g. "red running shoes", "stainless steel toaster", "65 inch flat screen tv"). Never include the store name, order numbers, SKUs, or model codes — those don\'t describe an appearance. If the receipt line is just an order number or a code with no descriptive words (e.g. "Order #112-4487205"), omit this field entirely rather than guessing.',
      },
    },
    required: ['found'],
  },
}

const app = express()
app.use(express.json({ limit: '15mb' }))

app.post('/api/scan-receipt', async (req, res) => {
  if (!anthropic) {
    return res.status(500).json({ error: 'server_missing_api_key' })
  }

  const { imageBase64, mediaType } = req.body || {}
  if (!imageBase64 || !mediaType) {
    return res.status(400).json({ error: 'missing_image' })
  }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 1024,
      tools: [EXTRACT_TOOL],
      tool_choice: { type: 'tool', name: 'record_receipt' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
            {
              type: 'text',
              text: 'Read this receipt photo and record its fields using the record_receipt tool. Only use words that are actually printed on the receipt — never invent a brand, model, or description that isn\'t there.',
            },
          ],
        },
      ],
    })

    const toolUse = message.content.find((block) => block.type === 'tool_use')
    if (!toolUse) {
      return res.status(502).json({ error: 'extraction_failed' })
    }

    const data = toolUse.input

    if (!data.found || !data.store || !data.price || !data.purchaseDate) {
      return res.status(422).json({ error: 'no_receipt_detected', reason: data.reason || null })
    }

    const category = data.category && RETURN_WINDOW_DAYS[data.category] ? data.category : 'Other'
    const returnDeadline = addDays(data.purchaseDate, RETURN_WINDOW_DAYS[category])
    const warrantyYears = WARRANTY_YEARS[category]
    const warrantyExpires = warrantyYears > 0 ? addYears(data.purchaseDate, warrantyYears) : null

    const storeImage = await findStoreImage(data.store, data.imageQuery || '')
    const stockImage = storeImage ? null : await findStockImage(data.imageQuery || '')
    if (stockImage?.downloadLocation) {
      // Required by Unsplash's API guidelines whenever a photo is actually shown to a user.
      fetch(stockImage.downloadLocation, { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` } }).catch(() => {})
    }

    const purchaseTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(data.purchaseTime || '') ? data.purchaseTime : null

    res.json({
      store: data.store,
      brand: data.store,
      product: data.product || 'Purchase',
      price: Number(data.price),
      currentPrice: Number(data.price),
      purchaseDate: data.purchaseDate,
      purchaseTime,
      category,
      returnDeadline,
      warrantyExpires,
      refund: { status: 'not_applicable' },
      imageUrl: storeImage?.url || stockImage?.url || null,
      imageSource: storeImage ? 'store' : stockImage ? 'stock' : null,
      imageStoreDomain: storeImage?.domain || null,
      imageSourcePage: storeImage?.sourcePage || null,
      imageCredit: stockImage ? { name: stockImage.photographerName, url: stockImage.photographerUrl } : null,
    })
  } catch (err) {
    console.error('scan-receipt failed:', err.message)
    res.status(500).json({ error: 'scan_failed' })
  }
})

app.listen(PORT, () => {
  const warnings = []
  if (!anthropic) warnings.push('no ANTHROPIC_API_KEY set — scans will fail')
  if (!GOOGLE_SEARCH_KEY || !GOOGLE_SEARCH_CX) warnings.push('no GOOGLE_SEARCH_API_KEY/GOOGLE_SEARCH_CX set — no store product photos')
  if (!UNSPLASH_KEY) warnings.push('no UNSPLASH_ACCESS_KEY set — no stock photo fallback')
  console.log(`ProofBack scan service listening on :${PORT}${warnings.length ? ' (' + warnings.join('; ') + ')' : ''}`)
})
