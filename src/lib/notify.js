import { getNeedsAttention } from './derive.js'

const NOTIFIED_KEY = 'proofback.notified.v1'

export function isNotificationSupported() {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function getNotificationPermission() {
  if (!isNotificationSupported()) return 'unsupported'
  return Notification.permission
}

export async function requestNotificationPermission() {
  if (!isNotificationSupported()) return 'unsupported'
  return Notification.requestPermission()
}

function loadNotifiedIds() {
  try {
    const raw = localStorage.getItem(NOTIFIED_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(parsed) ? parsed : [])
  } catch {
    return new Set()
  }
}

function saveNotifiedIds(ids) {
  try {
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify([...ids]))
  } catch {
    // ignore write failures
  }
}

async function showNotification(title, body) {
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready
      await reg.showNotification(title, { body, icon: '/logo-icon.png', badge: '/logo-icon.png' })
      return
    } catch {
      // fall through to a plain Notification below
    }
  }
  new Notification(title, { body, icon: '/logo-icon.png' })
}

// Checks for anything urgent that wasn't already notified about, and fires
// one OS notification summarizing it — meant to run once whenever the app
// is opened or brought to the foreground. This can't reach the user while
// the app/browser is fully closed: that would need a backend that holds
// (and watches) purchase data on a server, which this app deliberately
// doesn't have — everything stays local to the device. Each purchase is
// only notified about once, so re-opening the app doesn't repeat the same
// alert every time.
export async function checkAndNotifyUrgent(purchases, settings) {
  if (getNotificationPermission() !== 'granted') return

  const urgentItems = getNeedsAttention(purchases, settings).filter((item) => item.urgent)
  const notifiedIds = loadNotifiedIds()
  const fresh = urgentItems.filter((item) => !notifiedIds.has(item.id))
  if (fresh.length === 0) return

  const title = fresh.length === 1 ? 'ProofBack: 1 item needs attention' : `ProofBack: ${fresh.length} items need attention`
  const body = fresh.map((item) => `${item.label} — ${item.primaryText}`).join('\n')
  await showNotification(title, body)

  fresh.forEach((item) => notifiedIds.add(item.id))
  saveNotifiedIds(notifiedIds)
}
