// Shared by ReceiptInbox.jsx (the history log/upload entry point) and
// AddPurchase.jsx (which actually runs the scan when an inbox upload hands
// it a file) — kept here so neither screen needs to import the other.
// No real inbound email exists yet (see ReceiptInbox.jsx), so every entry
// here comes from a manual upload; the schema is written so a future real
// inbound-email pipeline could append to the same list unchanged.
const STORAGE_KEY = 'proofback.inbox.v1'

export function loadInboxItems() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function saveInboxItems(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

// status: 'processing' | 'processed' | 'needs_review'
export function addInboxItem({ id, fileName }) {
  const items = loadInboxItems()
  items.unshift({ id, fileName, status: 'processing', createdAt: new Date().toISOString(), purchaseId: null })
  saveInboxItems(items)
}

export function updateInboxItem(id, patch) {
  const items = loadInboxItems()
  const next = items.map((item) => (item.id === id ? { ...item, ...patch } : item))
  saveInboxItems(next)
}
