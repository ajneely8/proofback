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
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || ''
const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY || ''
const GOOGLE_SEARCH_KEY = process.env.GOOGLE_SEARCH_API_KEY || ''
const GOOGLE_SEARCH_CX = process.env.GOOGLE_SEARCH_CX || ''

const anthropic = ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null

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

const EXTRACT_SCHEMA = {
  type: 'object',
  properties: {
    found: {
      type: 'boolean',
      description:
        'true if this image shows any part of a purchase receipt with at least ONE usable field legible (a store name, a price, or a date) — set true even if other fields are cut off, blurry, or missing, and just omit those fields below. Only set false if nothing purchase-related is legible at all (e.g. a blank page, an unrelated photo, or a receipt fragment with no store/price/date anywhere on it).',
    },
    reason: {
      type: 'string',
      description: 'If found is false, a short reason why (e.g. "blurry", "not a receipt").',
    },
    store: { type: 'string', description: 'Store or merchant name as printed on the receipt.' },
    storeAddress: {
      type: 'string',
      description: 'Store street address and/or city/state, as printed. Omit if not printed.',
    },
    receiptNumber: {
      type: 'string',
      description: 'Receipt, order, or transaction number/ID as printed. Omit if not printed.',
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
    subtotal: {
      type: 'number',
      description: 'Subtotal before tax/tip, as printed. Omit if not printed.',
    },
    tax: {
      type: 'number',
      description: 'Tax amount, as printed. Omit if not printed.',
    },
    tip: {
      type: 'number',
      description: 'Tip/gratuity amount, as printed. Omit if not printed.',
    },
    discount: {
      type: 'number',
      description: 'Total discount amount applied to the whole receipt, as printed. Omit if not printed.',
    },
    total: {
      type: 'number',
      description: 'Final total amount paid, as printed. Omit if not printed.',
    },
    paymentMethod: {
      type: 'string',
      description:
        'Payment method as printed, e.g. "Visa ending 1234", "Cash", "Mastercard ****5678". Omit if not printed.',
    },
    returnByDate: {
      type: 'string',
      description:
        'ONLY if the receipt explicitly prints a return deadline, return policy window, or "receipt expires on" date — the resulting date in YYYY-MM-DD format. Omit entirely if the receipt does not explicitly state one; do not calculate or guess this.',
    },
    items: {
      type: 'array',
      description:
        'One entry per DISTINCT product on the receipt — if two different pairs of shoes were bought, that\'s two entries, not one. Do not merge different line items together, and do not create an entry for tax, shipping, discounts, subtotal, or total lines. If you were given more than one photo, treat them as sections/pages of the SAME receipt — combine all their line items into this one list and do not repeat an item that appears in more than one photo (e.g. one photo\'s bottom edge overlapping the next photo\'s top edge).',
      items: {
        type: 'object',
        properties: {
          product: {
            type: 'string',
            description: 'This line item\'s product name/description, as printed on the receipt.',
          },
          brand: {
            type: 'string',
            description:
              "This item's manufacturer/brand, if printed or obvious from the product name (e.g. \"Nike\", \"Samsung\") — NOT the store name unless the store's own house brand made it. Omit if not determinable.",
          },
          quantity: {
            type: 'number',
            description: 'Quantity purchased, as printed (e.g. "QTY 2" -> 2). Omit if not printed; assumed 1.',
          },
          price: {
            type: 'number',
            description:
              "This specific line's total price, as printed (numeric, no currency symbol) — the line total (already accounting for quantity), not the receipt grand total.",
          },
          discount: {
            type: 'number',
            description: "This specific line item's discount amount, as printed. Omit if not printed.",
          },
          category: {
            type: 'string',
            enum: ['Electronics', 'Apparel', 'Home', 'Grocery', 'Other'],
            description: "Best-guess category of this item.",
          },
          imageQuery: {
            type: 'string',
            description:
              'A short 2-5 word visual description of this item, built ONLY from words that actually describe what it looks like on the receipt (e.g. "red running shoes", "stainless steel toaster", "65 inch flat screen tv"). Never include the store name, order numbers, SKUs, or model codes — those don\'t describe an appearance. Omit this field entirely if the line is just an order number or a code with no descriptive words.',
          },
        },
        required: ['product', 'price'],
      },
    },
  },
  required: ['found'],
}

const app = express()
app.use(express.json({ limit: '15mb' }))

const EXTRACT_TOOL = {
  name: 'record_receipt',
  description: 'Record the fields read off one or more receipt photos.',
  input_schema: EXTRACT_SCHEMA,
}

app.post('/api/scan-receipt', async (req, res) => {
  if (!anthropic) {
    return res.status(500).json({ error: 'server_missing_api_key' })
  }

  // Accepts either a single { imageBase64, mediaType } (legacy) or
  // { images: [{ data, mediaType }, ...] } for a multi-page receipt — several
  // photos of one long receipt, sent together so the model can combine them
  // into a single extraction instead of treating each as a separate purchase.
  let images = Array.isArray(req.body?.images) ? req.body.images : null
  if (!images && req.body?.imageBase64 && req.body?.mediaType) {
    images = [{ data: req.body.imageBase64, mediaType: req.body.mediaType }]
  }
  if (!images || !images.length || images.some((img) => !img?.data || !img?.mediaType)) {
    return res.status(400).json({ error: 'missing_image' })
  }
  if (images.length > 6) {
    return res.status(400).json({ error: 'too_many_images' })
  }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 8192,
      tools: [EXTRACT_TOOL],
      tool_choice: { type: 'tool', name: 'record_receipt' },
      messages: [
        {
          role: 'user',
          content: [
            ...images.map((img) => ({
              type: 'image',
              source: { type: 'base64', media_type: img.mediaType, data: img.data },
            })),
            {
              type: 'text',
              text:
                (images.length > 1
                  ? `These ${images.length} photos are sections/pages of ONE SAME receipt, in order. Combine them into a single extraction — one store, one purchase date, one merged item list. If a line item appears in more than one photo (e.g. overlapping edges between shots), include it only once. `
                  : '') +
                'Read this receipt and record its fields using the record_receipt tool. Only use words that are actually printed on the receipt — never invent a brand, model, or description that isn\'t there. If you are unsure of a value, omit that field entirely rather than guessing.',
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

    // Only reject outright when the model couldn't read a receipt at all.
    // A receipt missing individual fields (no visible date, price cut off,
    // etc.) still goes through — the caller is told exactly which fields it
    // couldn't find instead of being forced to retake the photo.
    if (!data.found) {
      return res.status(422).json({ error: 'no_receipt_detected', reason: data.reason || null })
    }

    const missingFields = []
    if (!data.store) missingFields.push('store')
    if (!data.purchaseDate) missingFields.push('purchaseDate')
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(data.purchaseTime || '')) missingFields.push('purchaseTime')

    const purchaseDate = data.purchaseDate || toISO(new Date())
    const purchaseTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(data.purchaseTime || '') ? data.purchaseTime : null

    // Prefer a return deadline the receipt actually states over our generic
    // category guess — it's the real policy, not an estimate.
    const explicitReturnBy = /^\d{4}-\d{2}-\d{2}$/.test(data.returnByDate || '') ? data.returnByDate : null

    // A missing/empty items array still gets one placeholder row so the user
    // has something to fill in, rather than a receipt that silently vanishes.
    const rawItems = Array.isArray(data.items) && data.items.length ? data.items : [{}]

    const items = await Promise.all(
      rawItems.map(async (raw) => {
        const itemMissing = []
        if (!raw.product) itemMissing.push('product')
        if (!raw.price) itemMissing.push('price')

        const category = raw.category && RETURN_WINDOW_DAYS[raw.category] ? raw.category : 'Other'
        const returnDeadline = explicitReturnBy || addDays(purchaseDate, RETURN_WINDOW_DAYS[category])
        const returnDeadlineSource = explicitReturnBy ? 'receipt' : 'estimated'
        const warrantyYears = WARRANTY_YEARS[category]
        const warrantyExpires = warrantyYears > 0 ? addYears(purchaseDate, warrantyYears) : null
        if (warrantyYears === 0) itemMissing.push('warrantyExpires')

        // Prefer the model's short visual description, but fall back to the
        // raw product name so a lookup is still attempted when the model
        // omitted imageQuery (e.g. a line that's mostly a SKU/code) — and
        // lead with the brand when known, since "Nike red running shoes" is
        // a far more specific search than "red running shoes" alone.
        const baseQuery = raw.imageQuery || raw.product || ''
        const searchQuery = raw.brand && !baseQuery.toLowerCase().includes(raw.brand.toLowerCase())
          ? `${raw.brand} ${baseQuery}`
          : baseQuery

        const storeImage = await findStoreImage(data.store, searchQuery)
        const stockImage = storeImage ? null : await findStockImage(searchQuery)
        if (stockImage?.downloadLocation) {
          // Required by Unsplash's API guidelines whenever a photo is actually shown to a user.
          fetch(stockImage.downloadLocation, {
            headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` },
          }).catch(() => {})
        }

        return {
          product: raw.product || '',
          brand: raw.brand || data.store || '',
          quantity: raw.quantity && raw.quantity > 1 ? Number(raw.quantity) : 1,
          price: raw.price ? Number(raw.price) : '',
          currentPrice: raw.price ? Number(raw.price) : '',
          discount: raw.discount ?? null,
          category,
          returnDeadline,
          returnDeadlineSource,
          warrantyExpires,
          missingFields: itemMissing,
          imageUrl: storeImage?.url || stockImage?.url || null,
          imageSource: storeImage ? 'store' : stockImage ? 'stock' : null,
          imageStoreDomain: storeImage?.domain || null,
          imageSourcePage: storeImage?.sourcePage || null,
          imageCredit: stockImage ? { name: stockImage.photographerName, url: stockImage.photographerUrl } : null,
        }
      })
    )

    res.json({
      store: data.store || '',
      brand: data.store || '',
      storeAddress: data.storeAddress || null,
      receiptNumber: data.receiptNumber || null,
      purchaseDate,
      purchaseTime,
      subtotal: data.subtotal ?? null,
      tax: data.tax ?? null,
      tip: data.tip ?? null,
      discount: data.discount ?? null,
      total: data.total ?? null,
      paymentMethod: data.paymentMethod || null,
      refund: { status: 'not_applicable' },
      missingFields,
      items,
    })
  } catch (err) {
    console.error('scan-receipt failed:', err.status, err.message)
    if (err.status === 429) {
      return res.status(429).json({ error: 'rate_limited' })
    }
    if (err.status === 529 || err.status === 503) {
      return res.status(503).json({ error: 'model_overloaded' })
    }
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
