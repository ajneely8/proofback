import { useEffect } from 'react'
import { usePurchases } from '../lib/PurchasesContext.jsx'
import { useSettings } from '../lib/SettingsContext.jsx'
import { checkAndNotifyUrgent } from '../lib/notify.js'

// Renders nothing — just checks for anything newly urgent and fires a
// notification, once when the app first loads and again each time the tab
// is brought back to the foreground (covers "left it open in the
// background, deadline crossed the urgent line while I was away").
export default function NotificationWatcher() {
  const { purchases } = usePurchases()
  const { settings } = useSettings()

  useEffect(() => {
    checkAndNotifyUrgent(purchases, settings)

    function onVisible() {
      if (document.visibilityState === 'visible') checkAndNotifyUrgent(purchases, settings)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [purchases, settings])

  return null
}
