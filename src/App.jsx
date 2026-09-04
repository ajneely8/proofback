import { useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { PurchasesProvider } from './lib/PurchasesContext.jsx'
import { SettingsProvider } from './lib/SettingsContext.jsx'
import { hasOnboarded } from './lib/storage.js'
import BottomNav from './components/BottomNav.jsx'
import Onboarding from './screens/Onboarding.jsx'
import Home from './screens/Home.jsx'
import Purchases from './screens/Purchases.jsx'
import PurchaseDetail from './screens/PurchaseDetail.jsx'
import AddPurchase from './screens/AddPurchase.jsx'
import Opportunities from './screens/Opportunities.jsx'
import Profile from './screens/Profile.jsx'
import Account from './screens/profile/Account.jsx'
import Notifications from './screens/profile/Notifications.jsx'
import EmailConnections from './screens/profile/EmailConnections.jsx'
import Privacy from './screens/profile/Privacy.jsx'
import Subscription from './screens/profile/Subscription.jsx'
import Help from './screens/profile/Help.jsx'
import Terms from './screens/profile/Terms.jsx'

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

  if (!onboarded) {
    return (
      <Shell showNav={false}>
        <Onboarding onDone={() => setOnboardedState(true)} />
      </Shell>
    )
  }

  const noNavRoutes = ['/add']
  const showNav = !noNavRoutes.includes(location.pathname)

  return (
    <SettingsProvider>
      <PurchasesProvider>
        <Shell showNav={showNav}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/purchases" element={<Purchases />} />
            <Route path="/purchases/:id" element={<PurchaseDetail />} />
            <Route path="/add" element={<AddPurchase />} />
            <Route path="/opportunities" element={<Opportunities />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/account" element={<Account />} />
            <Route path="/profile/notifications" element={<Notifications />} />
            <Route path="/profile/email" element={<EmailConnections />} />
            <Route path="/profile/privacy" element={<Privacy />} />
            <Route path="/profile/subscription" element={<Subscription />} />
            <Route path="/profile/help" element={<Help />} />
            <Route path="/profile/terms" element={<Terms />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Shell>
      </PurchasesProvider>
    </SettingsProvider>
  )
}
