import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePurchases } from '../../lib/PurchasesContext.jsx'
import { isSupabaseConfigured } from '../../lib/supabaseClient.js'
import { IconChevronLeft, IconShield, IconLock, IconMail, IconCard } from '../../components/Icons.jsx'

const SECTIONS = [
  {
    Icon: IconMail,
    title: 'What ProofBack collects',
    body: 'Receipt photos you scan, the purchase details extracted from them (store, item, price, dates, and — when printed — serial/order numbers), and your account email if you sign up. That\'s it — no location, contacts, or browsing history.',
  },
  {
    Icon: IconShield,
    title: 'How receipts are processed',
    body: "When you scan a receipt, the photo is sent once to Anthropic's Claude API to read the store, items, prices, and dates off it. Anthropic processes it to answer that one request; ProofBack doesn't send it anywhere else, and the extracted data — not the raw request — is what gets saved.",
  },
  {
    Icon: IconLock,
    title: 'Where your data is stored',
    body: isSupabaseConfigured
      ? "Your purchases are stored in ProofBack's Supabase database, scoped to your account with Row Level Security — the database itself enforces that only you (or server code acting on your explicit request) can read or write your rows, not just the app's own logic."
      : "Accounts aren't set up on this deployment yet, so your purchases are stored only in this browser's local storage — nothing leaves this device.",
  },
  {
    Icon: IconCard,
    title: 'Payment information',
    body: 'If you subscribe to Pro or Family, card details are entered directly on Stripe\'s own hosted checkout page — they never pass through ProofBack\'s servers or database. ProofBack only ever sees whether a subscription is active, never your card number.',
  },
]

export default function Privacy() {
  const navigate = useNavigate()
  const { purchases, deletePurchases } = usePurchases()
  const [status, setStatus] = useState(null)

  function handleDeleteAll() {
    if (purchases.length === 0) return
    if (
      !window.confirm(
        `Permanently delete all ${purchases.length} purchase${purchases.length === 1 ? '' : 's'}? This can't be undone.`
      )
    ) {
      return
    }
    deletePurchases(purchases.map((p) => p.id))
    setStatus('deleted')
    setTimeout(() => setStatus(null), 3000)
  }

  return (
    <div className="screen">
      <button className="back-link" onClick={() => navigate(-1)}>
        <IconChevronLeft />
        Back
      </button>

      <div className="page-header">
        <h1>Privacy</h1>
        <p className="page-header__sub">What ProofBack collects, why, and how to delete it.</p>
      </div>

      {SECTIONS.map(({ Icon, title, body }) => (
        <section className="detail-card privacy-card" key={title}>
          <Icon className="privacy-card__icon" />
          <div>
            <div className="privacy-card__title">{title}</div>
            <div className="privacy-card__body">{body}</div>
          </div>
        </section>
      ))}

      <section className="detail-card">
        <div className="detail-card__label">Delete your data</div>
        <p className="field-hint" style={{ color: 'var(--text-secondary)', margin: '0 0 12px' }}>
          Permanently removes every purchase, receipt photo, and note you've saved. Your account itself stays
          signed in — this only clears the purchase data.
        </p>
        <button
          className="btn btn--secondary btn--block"
          onClick={handleDeleteAll}
          disabled={purchases.length === 0}
          style={{ borderColor: 'var(--accent-warn)', color: 'var(--accent-warn)' }}
        >
          Delete All My Purchase Data
        </button>
        {status === 'deleted' && <p className="field-hint field-hint--good">All purchase data deleted.</p>}
      </section>
    </div>
  )
}
