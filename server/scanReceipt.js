/**
 * Core receipt-scanning logic, shared between two hosts:
 *  - server/index.js (Express) for local dev, via `npm run dev`
 *  - api/scan-receipt.js (a Vercel serverless function) for production,
 *    since a Vercel deployment only serves the static frontend build and
 *    does not run server/index.js as a standing process at all.
 * Keeping the logic here means neither host can drift from the other.
 *
 * The Anthropic API key lives only on whichever host runs this — the
 * browser sends a photo and gets back structured fields, never the key.
 * Return-window and warranty lengths are generic category defaults (not
 * real per-retailer policy, which nothing in this app has access to) so
 * they're applied here rather than trusted from the model. Rather than
 * guessing at a photo of the exact item (which a text-based image search
 * kept getting wrong), each item just shows its brand's company logo — a
 * much more reliable thing to fetch by name, via Clearbit's public logo API.
 */
import Anthropic from '@anthropic-ai/sdk'

let anthropic = null
function getClient() {
  const key = process.env.ANTHROPIC_API_KEY || ''
  if (!key) return null
  if (!anthropic) anthropic = new Anthropic({ apiKey: key, maxRetries: 2 })
  return anthropic
}

// A serverless function occasionally can't establish a connection to
// Anthropic's API on the first try (a cold-start network blip, not an auth
// or request problem — the SDK's own maxRetries doesn't always cover this
// case cleanly), so retry a couple more times specifically for that class of
// error before giving up. Auth/rate-limit/bad-request errors are real
// answers, not transient — those still fail immediately.
async function createMessageWithRetry(client, params, attempts = 3) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await client.messages.create(params)
    } catch (err) {
      const isConnectionError = err instanceof Anthropic.APIConnectionError
      if (!isConnectionError || attempt === attempts) throw err
      await new Promise((resolve) => setTimeout(resolve, 400 * attempt))
    }
  }
}

// Known store name -> domain, for a same-pattern logo/domain guess.
// Not exhaustive — unlisted stores fall through to a same-pattern guess
// (spaces/punctuation stripped + ".com"), which is right often enough to be
// worth trying but isn't guaranteed.
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
  macys: 'macys.com',
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
 * Clearbit's logo API serves a company's logo directly from its domain —
 * https://logo.clearbit.com/nike.com — with no key or request needed on our
 * end; the browser just loads the URL as an <img src>. Since it's a direct
 * image URL rather than a search result, there's nothing to fetch or
 * validate server-side: an unrecognized domain simply 404s in the browser,
 * which the client already treats as "no logo" for that item.
 */
function logoUrlFor(name) {
  const domain = guessStoreDomain(name)
  return domain ? `https://logo.clearbit.com/${domain}?size=160` : null
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
          size: {
            type: 'string',
            description:
              'The size itself, if this line item has one — just the number/letter (e.g. "10.5", "M", "LARGE"), without the gender/fit word even if the receipt prints them together (e.g. "MEN\'S 10.5" -> size "10.5", gender "Men\'s"). Omit entirely if no size is printed for this item.',
          },
          gender: {
            type: 'string',
            enum: ["Men's", "Women's", "Boys'", "Girls'", 'Unisex'],
            description:
              "This shoe/clothing item's gender or fit, ONLY if printed or clearly abbreviated on the receipt (e.g. \"MENS\", \"WMNS\", \"BOYS\", \"M\" next to a shoe line). Omit entirely for non-apparel items or when nothing on the receipt indicates one — never guess this from the product name alone.",
          },
          color: {
            type: 'string',
            description:
              'Color as printed on the receipt, if this line item has one (e.g. "BLACK", "Red/White"). Omit entirely if no color is printed for this item.',
          },
          sku: {
            type: 'string',
            description:
              'SKU, item number, or product code as printed on the receipt for this line (e.g. "SKU 4502761", "ITEM# 88291", a UPC number). Omit entirely if nothing like that is printed for this item.',
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
            description: 'Best-guess category of this item.',
          },
        },
        required: ['product', 'price'],
      },
    },
  },
  required: ['found'],
}

const EXTRACT_TOOL = {
  name: 'record_receipt',
  description: 'Record the fields read off one or more receipt photos.',
  input_schema: EXTRACT_SCHEMA,
}

/**
 * Takes a parsed request body ({ images: [{data, mediaType}] } or the legacy
 * { imageBase64, mediaType }) and returns { status, body } — never throws,
 * so both hosts can just do res.status(status).json(body).
 */
export async function scanReceipt(reqBody) {
  const anthropicClient = getClient()
  if (!anthropicClient) {
    return { status: 500, body: { error: 'server_missing_api_key' } }
  }

  // Accepts either a single { imageBase64, mediaType } (legacy) or
  // { images: [{ data, mediaType }, ...] } for a multi-page receipt — several
  // photos of one long receipt, sent together so the model can combine them
  // into a single extraction instead of treating each as a separate purchase.
  let images = Array.isArray(reqBody?.images) ? reqBody.images : null
  if (!images && reqBody?.imageBase64 && reqBody?.mediaType) {
    images = [{ data: reqBody.imageBase64, mediaType: reqBody.mediaType }]
  }
  if (!images || !images.length || images.some((img) => !img?.data || !img?.mediaType)) {
    return { status: 400, body: { error: 'missing_image' } }
  }
  if (images.length > 6) {
    return { status: 400, body: { error: 'too_many_images' } }
  }

  try {
    const message = await createMessageWithRetry(anthropicClient, {
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
      return { status: 502, body: { error: 'extraction_failed' } }
    }
    const data = toolUse.input

    // Only reject outright when the model couldn't read a receipt at all.
    // A receipt missing individual fields (no visible date, price cut off,
    // etc.) still goes through — the caller is told exactly which fields it
    // couldn't find instead of being forced to retake the photo.
    if (!data.found) {
      return { status: 422, body: { error: 'no_receipt_detected', reason: data.reason || null } }
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

    const items = rawItems.map((raw) => {
      const itemMissing = []
      if (!raw.product) itemMissing.push('product')
      if (!raw.price) itemMissing.push('price')

      const category = raw.category && RETURN_WINDOW_DAYS[raw.category] ? raw.category : 'Other'
      const returnDeadline = explicitReturnBy || addDays(purchaseDate, RETURN_WINDOW_DAYS[category])
      const returnDeadlineSource = explicitReturnBy ? 'receipt' : 'estimated'
      const warrantyYears = WARRANTY_YEARS[category]
      const warrantyExpires = warrantyYears > 0 ? addYears(purchaseDate, warrantyYears) : null
      if (warrantyYears === 0) itemMissing.push('warrantyExpires')

      return {
        product: raw.product || '',
        brand: raw.brand || data.store || '',
        size: raw.size || null,
        gender: raw.gender || null,
        color: raw.color || null,
        sku: raw.sku || null,
        quantity: raw.quantity && raw.quantity > 1 ? Number(raw.quantity) : 1,
        price: raw.price ? Number(raw.price) : '',
        currentPrice: raw.price ? Number(raw.price) : '',
        discount: raw.discount ?? null,
        category,
        returnDeadline,
        returnDeadlineSource,
        warrantyExpires,
        missingFields: itemMissing,
        logoUrl: logoUrlFor(raw.brand || data.store),
      }
    })

    return {
      status: 200,
      body: {
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
      },
    }
  } catch (err) {
    // err.message on an APIConnectionError is always the generic
    // "Connection error." — the actual DNS/TLS/timeout reason is nested in
    // err.cause, which the earlier version of this log didn't print at all.
    console.error('scan-receipt failed:', err.status, err.message, err.cause || err)
    if (err.status === 429) {
      return { status: 429, body: { error: 'rate_limited' } }
    }
    if (err.status === 529 || err.status === 503) {
      return { status: 503, body: { error: 'model_overloaded' } }
    }
    if (err instanceof Anthropic.APIConnectionError) {
      return { status: 503, body: { error: 'connection_error' } }
    }
    return { status: 500, body: { error: 'scan_failed' } }
  }
}

export function scanReceiptWarnings() {
  const warnings = []
  if (!process.env.ANTHROPIC_API_KEY) warnings.push('no ANTHROPIC_API_KEY set — scans will fail')
  return warnings
}
