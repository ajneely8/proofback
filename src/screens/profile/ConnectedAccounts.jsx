import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { usePurchases } from '../../lib/PurchasesContext.jsx'
import { matchTransactionToPurchase, formatMoney, formatDate, productLabel } from '../../lib/derive.js'
import { IconChevronLeft } from '../../components/Icons.jsx'

const STORAGE_KEY = 'proofback.transactions.v1'

function loadTransactions() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function saveTransactions(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// No real bank connection exists yet (that needs a service like Plaid, with
// its own account/API keys) — this screen builds the matching UI and logic
// against transactions the user types in themselves, so the feature can be
// tried today and switched to a live feed later without changing this UI.
export default function ConnectedAccounts() {
  const navigate = useNavigate()
  const { purchases } = usePurchases()
  const [transactions, setTransactions] = useState(loadTransactions)
  const [form, setForm] = useState({ store: '', amount: '', date: todayISO() })

  function addTransaction() {
    if (!form.store || form.amount === '') return
    const next = [{ id: `txn-${Date.now()}`, store: form.store, amount: Number(form.amount), date: form.date }, ...transactions]
    setTransactions(next)
    saveTransactions(next)
    setForm({ store: '', amount: '', date: todayISO() })
  }

  function removeTransaction(id) {
    const next = transactions.filter((t) => t.id !== id)
    setTransactions(next)
    saveTransactions(next)
  }

  return (
    <div className="screen">
      <button className="back-link" onClick={() => navigate(-1)}>
        <IconChevronLeft />
        Back
      </button>

      <div className="page-header">
        <h1>Connected Accounts</h1>
        <p className="page-header__sub">
          ProofBack doesn't have a live bank or card connection yet — that needs a secure third-party service, set up
          separately. In the meantime, add a transaction below to see how ProofBack would match it to a saved receipt.
        </p>
      </div>

      <section className="detail-card">
        <div className="detail-card__label">Add a Transaction</div>
        <div className="field-row">
          <label>Store</label>
          <input type="text" value={form.store} onChange={(e) => setForm((f) => ({ ...f, store: e.target.value }))} />
        </div>
        <div className="field-row">
          <label>Amount</label>
          <div className="field-row__money">
            <span>$</span>
            <input
              type="number"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            />
          </div>
        </div>
        <div className="field-row">
          <label>Date</label>
          <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
        </div>
        <button className="btn btn--primary btn--block" disabled={!form.store || form.amount === ''} onClick={addTransaction} style={{ marginTop: 10 }}>
          Add Transaction
        </button>
      </section>

      {transactions.length > 0 && (
        <div className="list">
          {transactions.map((t) => {
            const match = matchTransactionToPurchase(t, purchases)
            return (
              <div className="detail-card txn-row" key={t.id}>
                <div className="txn-row__head">
                  <div>
                    <div className="txn-row__store">{t.store}</div>
                    <div className="txn-row__date">{formatDate(t.date)}</div>
                  </div>
                  <div className="txn-row__amount">-{formatMoney(t.amount)}</div>
                </div>
                {match ? (
                  <div className="txn-row__result txn-row__result--good">
                    <div className="txn-row__result-title">Match Found ✓</div>
                    <Link to={`/purchases/${match.id}`} className="txn-row__result-detail">
                      {productLabel(match)} — {formatMoney(match.price)} — Receipt saved
                    </Link>
                  </div>
                ) : (
                  <div className="txn-row__result txn-row__result--warn">
                    <div className="txn-row__result-title">Receipt Missing</div>
                    <p className="field-hint field-hint--block" style={{ margin: '2px 0 8px' }}>
                      We found a {t.store} transaction for {formatMoney(t.amount)}, but there is no receipt saved in
                      ProofBack.
                    </p>
                    <Link to="/add" className="btn btn--secondary btn--small">
                      Add Receipt
                    </Link>
                  </div>
                )}
                <button className="link-action link-action--inline link-action--danger" onClick={() => removeTransaction(t.id)}>
                  Remove
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
