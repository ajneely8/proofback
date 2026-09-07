import { useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { PurchasesProvider } from './lib/PurchasesContext.jsx'
import { SettingsProvider } from './lib/SettingsContext.jsx'
import { useAuth } from './lib/AuthContext.jsx'
import { isSupabaseConfigured } from './lib/supabaseClient.js'
import { hasOnboarded, getAnonScanCount, ANON_FREE_SCAN_LIMIT } from './lib/storage.js'
import BottomNav from './components/BottomNav.jsx'
import NotificationWatcher from './components/NotificationWatcher.jsx'
import ThemeEffect from './components/ThemeEffect.jsx'
import Onboarding from './screens/Onboarding.jsx'
import Auth from './screens/Auth.jsx'
import Home from './screens/Home.jsx'
import Purchases from './screens/Purchases.jsx'
import Insights from './screens/Insights.jsx'
import PurchaseDetail from './screens/PurchaseDetail.jsx'
import ReceiptGroup from './screens/ReceiptGroup.jsx'
import EvidencePackage from './screens/EvidencePackage.jsx'
import AddPurchase from './screens/AddPurchase.jsx'
import Alerts from './screens/Alerts.jsx'
import ReceiptInbox from './screens/ReceiptInbox.jsx'
import Profile from './screens/Profile.jsx'
import Account from './screens/profile/Account.jsx'
import Notifications from './screens/profile/Notifications.jsx'
import EmailConnections from './screens/profile/EmailConnections.jsx'
import ConnectedAccounts from './screens/profile/ConnectedAccounts.jsx'
import Privacy from './screens/profile/Privacy.jsx'
import Subscription from './screens/profile/Subscription.jsx'
import Help from './screens/profile/Help.jsx'
import Terms from './screens/profile/Terms.jsx'
import History from './screens/profile/History.jsx'

function Shell({ children, showNav = true }) {
  return (
    <div className="app-shell">
      <div className="app-content">{children}</div>
      {showNav && <BottomNav />}
    </div>
  )
}

export default function App() {
  const [onboarded, setOnboardedState] = useState(hasOnboarded())
  const location = useLocation()
  const { user, loading } = useAuth()

  // Accounts are opt-in until VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY are
  // set — until then, skip straight to onboarding exactly as it worked before
  // accounts existed, using local storage. Once those env vars are added,
  // this switches over on its own with no code change.
  //
  // A brand-new visitor gets ANON_FREE_SCAN_LIMIT free scans before an
  // account is required — read directly here (not via state) since App
  // already re-renders on every route change (useLocation below), so this
  // stays current the moment AddPurchase.jsx increments it after the 5th
  // scan, no extra plumbing needed.
  if (isSupabaseConfigured) {
    if (loading) {
      return <Shell showNav={false}>{null}</Shell>
    }

    if (!user && getAnonScanCount() >= ANON_FREE_SCAN_LIMIT) {
      return (
        <Shell showNav={false}>
          <Auth reason="You've used your 5 free scans — create an account to keep scanning and save what you've found." />
        </Shell>
      )
    }
  }

  if (!onboarded) {
    return (
      <Shell showNav={false}>
        <Onboarding onDone={() => setOnboardedState(true)} />
      </Shell>
    )
  }

  return (
    <SettingsProvider>
      <PurchasesProvider>
        <>
          <ThemeEffect />
          <NotificationWatcher />
          <Shell>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/purchases" element={<Purchases />} />
              <Route path="/insights" element={<Insights />} />
              <Route path="/purchases/:id" element={<PurchaseDetail />} />
              <Route path="/receipt/:groupKey" element={<ReceiptGroup />} />
              <Route path="/purchases/:id/evidence" element={<EvidencePackage />} />
              <Route path="/add" element={<AddPurchase />} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/inbox" element={<ReceiptInbox />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/profile/account" element={<Account />} />
              <Route path="/profile/notifications" element={<Notifications />} />
              <Route path="/profile/email" element={<EmailConnections />} />
              <Route path="/profile/accounts" element={<ConnectedAccounts />} />
              <Route path="/profile/privacy" element={<Privacy />} />
              <Route path="/profile/subscription" element={<Subscription />} />
              <Route path="/profile/help" element={<Help />} />
              <Route path="/profile/terms" element={<Terms />} />
              <Route path="/profile/history" element={<History />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Shell>
        </>
      </PurchasesProvider>
    </SettingsProvider>
  )
}
