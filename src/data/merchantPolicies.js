// A shared, client-side merchant-policy lookup — surfaced on the Purchase
// Passport and inside a recovery case so a return/claim shows the relevant
// policy right where it's needed, instead of the user having to go look it
// up themselves. This mirrors the domain-guessing approach already used in
// src/lib/logo.js and server/scanReceipt.js (each keeps its own copy rather
// than sharing server code into the client bundle) — this is ProofBack's
// general, typical understanding of each store's stated policy, not a live
// lookup or a guarantee; it's always labeled that way wherever it's shown.
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
  return match ? STORE_DOMAINS[match] : null
}

// Only covers stores common enough to be worth curating by hand — an
// unrecognized store simply has no policy card to show, rather than a
// guessed one.
const MERCHANT_POLICIES = {
  'nike.com': { returnWindowDays: 60, receiptRequired: false, exclusions: ['Final sale items', 'Customized/Nike By You products'], restockingFeePercent: 0, refundMethod: 'Original payment method', warrantyInstructions: 'Contact Nike Support with proof of purchase for manufacturing defects.' },
  'adidas.com': { returnWindowDays: 30, receiptRequired: false, exclusions: ['Final sale/clearance items'], restockingFeePercent: 0, refundMethod: 'Original payment method', warrantyInstructions: 'Contact adidas Support with proof of purchase.' },
  'amazon.com': { returnWindowDays: 30, receiptRequired: false, exclusions: ['Digital items', 'Some hazardous materials'], restockingFeePercent: 0, refundMethod: 'Original payment method or Amazon balance', warrantyInstructions: "Check the item's product page for manufacturer warranty details, or contact the seller." },
  'bestbuy.com': { returnWindowDays: 15, receiptRequired: true, exclusions: ['Opened software', 'Some drones/cameras (shorter window)'], restockingFeePercent: 15, refundMethod: 'Original payment method', warrantyInstructions: 'Geek Squad or manufacturer warranty — bring receipt and product to any Best Buy.' },
  'target.com': { returnWindowDays: 90, receiptRequired: false, exclusions: ['Opened electronics may have a shorter window'], restockingFeePercent: 0, refundMethod: 'Original payment method or Target GiftCard', warrantyInstructions: 'Manufacturer warranty applies — contact the brand directly for defects after the return window.' },
  'walmart.com': { returnWindowDays: 90, receiptRequired: false, exclusions: ['Electronics often 30 days, not 90'], restockingFeePercent: 0, refundMethod: 'Original payment method', warrantyInstructions: 'Manufacturer warranty applies — contact the brand directly.' },
  'costco.com': { returnWindowDays: null, receiptRequired: false, exclusions: ['Electronics limited to 90 days'], restockingFeePercent: 0, refundMethod: 'Original payment method', warrantyInstructions: "Costco's own extended warranty may apply on electronics — check Costco Concierge Services." },
  'homedepot.com': { returnWindowDays: 90, receiptRequired: true, exclusions: ['Custom/special orders', 'Gas-powered equipment after use'], restockingFeePercent: 0, refundMethod: 'Original payment method', warrantyInstructions: 'Manufacturer warranty applies — contact the brand directly.' },
  'lowes.com': { returnWindowDays: 90, receiptRequired: true, exclusions: ['Custom/special orders'], restockingFeePercent: 0, refundMethod: 'Original payment method', warrantyInstructions: 'Manufacturer warranty applies — contact the brand directly.' },
  'apple.com': { returnWindowDays: 14, receiptRequired: true, exclusions: ['Custom-engraved products', 'Opened software'], restockingFeePercent: 0, refundMethod: 'Original payment method', warrantyInstructions: 'AppleCare or the standard 1-year limited warranty — start a claim at support.apple.com or an Apple Store.' },
  'samsung.com': { returnWindowDays: 30, receiptRequired: true, exclusions: [], restockingFeePercent: 0, refundMethod: 'Original payment method', warrantyInstructions: 'Standard manufacturer warranty — start a claim at samsung.com/support.' },
  'macys.com': { returnWindowDays: 90, receiptRequired: false, exclusions: ['Some fine jewelry/furniture have shorter windows'], restockingFeePercent: 0, refundMethod: 'Original payment method', warrantyInstructions: 'Manufacturer warranty applies — contact the brand directly.' },
  'ikea.com': { returnWindowDays: 365, receiptRequired: true, exclusions: ['Custom cut fabric/countertops', 'As-is items'], restockingFeePercent: 0, refundMethod: 'Original payment method', warrantyInstructions: 'Most IKEA furniture carries its own multi-year limited warranty — check the product\'s warranty leaflet or IKEA.com.' },
  'wayfair.com': { returnWindowDays: 30, receiptRequired: false, exclusions: ['Assembled/used furniture', 'Final sale items'], restockingFeePercent: 0, refundMethod: 'Original payment method', warrantyInstructions: 'Contact Wayfair customer service for manufacturing defects.' },
  'fleetfeet.com': { returnWindowDays: 60, receiptRequired: true, exclusions: ['Worn/washed items'], restockingFeePercent: 0, refundMethod: 'Original payment method or store credit', warrantyInstructions: 'Contact the store location for manufacturer defect claims.' },
  'brooksrunning.com': { returnWindowDays: 45, receiptRequired: false, exclusions: [], restockingFeePercent: 0, refundMethod: 'Original payment method', warrantyInstructions: 'Brooks Run Happy Guarantee covers defects — contact Brooks Support.' },
  'rei.com': { returnWindowDays: 365, receiptRequired: false, exclusions: ['Non-members may have a shorter window'], restockingFeePercent: 0, refundMethod: 'Original payment method or store credit', warrantyInstructions: "REI's satisfaction guarantee covers most gear defects for its return window." },
  'dickssportinggoods.com': { returnWindowDays: 90, receiptRequired: false, exclusions: ['Firearms/ammunition', 'Uninstalled electronics after 30 days'], restockingFeePercent: 0, refundMethod: 'Original payment method', warrantyInstructions: 'Manufacturer warranty applies — contact the brand directly.' },
}

export function getMerchantPolicy(storeName) {
  const domain = guessStoreDomain(storeName)
  return domain ? MERCHANT_POLICIES[domain] || null : null
}
