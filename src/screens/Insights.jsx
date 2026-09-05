import { useNavigate } from 'react-router-dom'
import { usePurchases } from '../lib/PurchasesContext.jsx'
import { getSpendByCategory, getSpendByMonth, formatMoney, formatDate, productLabel, categoryColor } from '../lib/derive.js'
import { IconChevronLeft, IconTarget } from '../components/Icons.jsx'
import Thumb from '../components/Thumb.jsx'
import EmptyState from '../components/EmptyState.jsx'

export default function Insights() {
  const navigate = useNavigate()
  const { purchases } = usePurchases()

  const byCategory = getSpendByCategory(purchases)
  const byMonth = getSpendByMonth(purchases, 6)
  const topPurchases = [...purchases].sort((a, b) => b.price - a.price).slice(0, 5)

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
                <strong>{formatMoney(c.total)}</strong>
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
            <button
              key={p.id}
              className="list-row list-row--simple"
              onClick={() => navigate(`/purchases/${p.id}`)}
              style={{ '--row-accent': categoryColor(p.category) }}
            >
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
    </div>
  )
}
