import { useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { PurchasesProvider } from './lib/PurchasesContext.jsx'
import { SettingsProvider } from './lib/SettingsContext.jsx'
import { WatchlistProvider } from './lib/WatchlistContext.jsx'
import { useAuth } from './lib/AuthContext.jsx'
import { isSupabaseConfigured } from './lib/supabaseClient.js'
import { hasOnboarded } from './lib/storage.js'
import BottomNav from './components/BottomNav.jsx'
import NotificationWatcher from './components/NotificationWatcher.jsx'
import ThemeEffect from './components/ThemeEffect.jsx'
import Onboarding from './screens/Onboarding.jsx'
import Auth from './screens/Auth.jsx'
import Home from './screens/Home.jsx'
import Purchases from './screens/Purchases.jsx'
import Insights from './screens/Insights.jsx'
import Watchlist from './screens/Watchlist.jsx'
import PurchaseDetail from './screens/PurchaseDetail.jsx'
import AddPurchase from './screens/AddPurchase.jsx'
import Alerts from './screens/Alerts.jsx'
import Profile from './screens/Profile.jsx'
import Account from './screens/profile/Account.jsx'
import Notifications from './screens/profile/Notifications.jsx'
import EmailConnections from './screens/profile/EmailConnections.jsx'
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
  // this switches over on its own with no code change. Signing up/in comes
  // before the onboarding carousel so a new visitor lands on an account
  // screen first, not several slides of marketing.
  if (isSupabaseConfigured) {
    if (loading) {
      return <Shell showNav={false}>{null}</Shell>
    }

    if (!user) {
      return (
        <Shell showNav={false}>
          <Auth />
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
        <WatchlistProvider>
          <ThemeEffect />
          <NotificationWatcher />
          <Shell>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/purchases" element={<Purchases />} />
              <Route path="/insights" element={<Insights />} />
              <Route path="/watchlist" element={<Watchlist />} />
              <Route path="/purchases/:id" element={<PurchaseDetail />} />
              <Route path="/add" element={<AddPurchase />} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/profile/account" element={<Account />} />
              <Route path="/profile/notifications" element={<Notifications />} />
              <Route path="/profile/email" element={<EmailConnections />} />
              <Route path="/profile/privacy" element={<Privacy />} />
              <Route path="/profile/subscription" element={<Subscription />} />
              <Route path="/profile/help" element={<Help />} />
              <Route path="/profile/terms" element={<Terms />} />
              <Route path="/profile/history" element={<History />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Shell>
        </WatchlistProvider>
      </PurchasesProvider>
    </SettingsProvider>
  )
}
