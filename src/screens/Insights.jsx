import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePurchases } from '../lib/PurchasesContext.jsx'
import { getSpendByCategory, getSpendByMonth, formatMoney, formatDate, productLabel, categoryColor } from '../lib/derive.js'
import { IconChevronLeft, IconTarget } from '../components/Icons.jsx'
import Thumb from '../components/Thumb.jsx'
import EmptyState from '../components/EmptyState.jsx'

const PERIODS = ['All', 'Week', 'Month', 'Year']

function todayLocal() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function periodStart(period) {
  const now = todayLocal()
  if (period === 'Week') {
    const d = new Date(now)
    d.setDate(d.getDate() - 7)
    return d
  }
  if (period === 'Month') return new Date(now.getFullYear(), now.getMonth(), 1)
  if (period === 'Year') return new Date(now.getFullYear(), 0, 1)
  return null
}

export default function Insights() {
  const navigate = useNavigate()
  const { purchases } = usePurchases()
  const [period, setPeriod] = useState('All')
  const [store, setStore] = useState('')
  const [category, setCategory] = useState('')

  const stores = useMemo(() => [...new Set(purchases.map((p) => p.store).filter(Boolean))].sort(), [purchases])
  const categories = useMemo(() => [...new Set(purchases.map((p) => p.category).filter(Boolean))].sort(), [purchases])

  const filtered = useMemo(() => {
    const start = periodStart(period)
    return purchases.filter((p) => {
      if (start && (!p.purchaseDate || new Date(p.purchaseDate) < start)) return false
      if (store && p.store !== store) return false
      if (category && p.category !== category) return false
      return true
    })
  }, [purchases, period, store, category])

  const totalPurchases = Math.round(filtered.reduce((sum, p) => sum + (Number(p.price) || 0), 0) * 100) / 100
  const byCategory = getSpendByCategory(filtered)
  const byMonth = getSpendByMonth(filtered, 6)
  const topPurchases = [...filtered].sort((a, b) => b.price - a.price).slice(0, 5)

  const categoryMax = Math.max(1, ...byCategory.map((c) => c.total))
  const monthMax = Math.max(1, ...byMonth.map((m) => m.total))

  if (purchases.length === 0) {
    return (
      <div className="screen">
        <button className="back-link" onClick={() => navigate(-1)}>
          <IconChevronLeft />
          Back
        </button>
        <div className="page-header">
          <h1>Insights</h1>
        </div>
        <EmptyState
          icon={IconTarget}
          title="Nothing to show yet"
          detail="Add or scan a purchase to see your spending broken down here."
        />
      </div>
    )
  }

  return (
    <div className="screen">
      <button className="back-link" onClick={() => navigate(-1)}>
        <IconChevronLeft />
        Back
      </button>

      <div className="page-header">
        <h1>Insights</h1>
      </div>

      <section className="summary summary--compact">
        <div className="summary__label">Total Purchases</div>
        <div className="summary__amount">{formatMoney(totalPurchases)}</div>
        <div className="summary__hint">
          Across {filtered.length} purchase{filtered.length === 1 ? '' : 's'}
        </div>
      </section>

      <div className="chip-row">
        {PERIODS.map((p) => (
          <button key={p} className={'chip' + (period === p ? ' is-active' : '')} onClick={() => setPeriod(p)}>
            {p}
          </button>
        ))}
      </div>

      <div className="insights-filters">
        <select value={store} onChange={(e) => setStore(e.target.value)}>
          <option value="">All Stores</option>
          {stores.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={IconTarget} title="Nothing matches" detail="Try a different period, store, or category." />
      ) : (
        <>
          <section className="section">
            <div className="section__title">Last 6 months</div>
            <div className="month-chart">
              {byMonth.map((m) => (
                <div className="month-chart__col" key={m.key}>
                  <div className="month-chart__bar-track">
                    <div
                      className="month-chart__bar"
                      style={{ height: `${Math.max(4, (m.total / monthMax) * 100)}%` }}
                    />
                  </div>
                  <div className="month-chart__label">{m.label}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="section">
            <div className="section__title">By category</div>
            <div className="category-bars">
              {byCategory.map((c) => (
                <div className="category-bars__row" key={c.category}>
                  <div className="category-bars__head">
                    <span>{c.category}</span>
                    <strong className="text-accent">{formatMoney(c.total)}</strong>
                  </div>
                  <div className="category-bars__track">
                    <div
                      className="category-bars__fill"
                      style={{ width: `${(c.total / categoryMax) * 100}%`, background: categoryColor(c.category) }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="section">
            <div className="section__title">Biggest purchases</div>
            <div className="list">
              {topPurchases.map((p) => (
                <button key={p.id} className="list-row list-row--simple" onClick={() => navigate(`/purchases/${p.id}`)}>
                  <Thumb purchase={p} />
                  <div className="list-row__main">
                    <div className="list-row__title">{productLabel(p)}</div>
                    <div className="list-row__line">{p.store}</div>
                  </div>
                  <div className="list-row__trailing">
                    <div className="list-row__price">{formatMoney(p.price)}</div>
                    <div className="list-row__line">{formatDate(p.purchaseDate)}</div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
