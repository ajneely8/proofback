// Receipts print everything in a store's own house style — usually
// ALL CAPS, and often repeating the brand at the start of the item name
// (e.g. a Nike receipt printing "NIKE NIKE P-6000" because the brand column
// and the item description both start with it). Cleans that up for display
// without touching what's actually stored raw from the receipt anywhere else.

function titleCase(str) {
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => {
      if (!word) return word
      // Keep short all-caps tokens that are actually model numbers/codes
      // (e.g. "P-6000", "XL") looking like codes rather than words.
      if (/\d/.test(word)) return word.toUpperCase()
      return word[0].toUpperCase() + word.slice(1)
    })
    .join(' ')
}

// Only re-cases a string that's ALL CAPS (or has no lowercase letters at
// all) — a name that already has normal mixed case (e.g. from manual entry)
// is left exactly as the user typed it.
function isShouting(str) {
  return str === str.toUpperCase() && str !== str.toLowerCase()
}

export function normalizeProductName(product, brand) {
  if (!product) return product
  let name = product.trim()

  // Drop a leading repeat of the brand name (case-insensitive), so
  // "NIKE NIKE P-6000" with brand "Nike" becomes "P-6000", not "Nike P-6000
  // P-6000" or similar — productLabel() already prepends the brand
  // elsewhere, so the stored name shouldn't duplicate it.
  if (brand) {
    const brandWord = brand.trim()
    const pattern = new RegExp(`^${brandWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+`, 'i')
    name = name.replace(pattern, '')
  }

  if (isShouting(name)) name = titleCase(name)

  return name.trim() || product.trim()
}

export function normalizeBrandName(brand) {
  if (!brand) return brand
  const name = brand.trim()
  return isShouting(name) ? titleCase(name) : name
}
