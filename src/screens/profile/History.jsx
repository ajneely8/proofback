import { useNavigate } from 'react-router-dom'
import { usePurchases } from '../../lib/PurchasesContext.jsx'
import { getSavingsEvents, getTotalSaved, formatDate, formatMoney, productLabel, categoryColor } from '../../lib/derive.js'
import { IconChevronLeft, IconChevronRight, IconClock, IconDoc } from '../../components/Icons.jsx'
import Thumb from '../../components/Thumb.jsx'
import Sparkline from '../../components/Sparkline.jsx'
import EmptyState from '../../components/EmptyState.jsx'

export default function History() {
  const navigate = useNavigate()
  const { purchases } = usePurchases()
  const events = getSavingsEvents(purchases)
  const totalSaved = getTotalSaved(purchases)

  const receipts = [...purchases].sort((a, b) => (a.purchaseDate < b.purchaseDate ? 1 : -1))

  return (
    <div className="screen">
      <button className="back-link" onClick={() => navigate(-1)}>
        <IconChevronLeft />
        Back
      </button>

      <div className="page-header">
        <h1>History</h1>
      </div>

      <section className="summary summary--compact summary--with-chart">
        <div>
          <div className="summary__label">Saved over time</div>
          <div className="summary__amount">{formatMoney(totalSaved)}</div>
          <div className="summary__hint">
            From {events.length} confirmed return{events.length === 1 ? '' : 's'}, refund{events.length === 1 ? '' : 's'}, and price adjustment{events.length === 1 ? '' : 's'}
          </div>
        </div>
        <Sparkline events={events} />
      </section>

      <section className="section">
        <div className="section__title">Savings timeline</div>
        {events.length === 0 ? (
          <EmptyState
            icon={IconClock}
            title="Nothing confirmed yet"
            detail="Mark a return complete, a refund received, or a price adjustment applied on a purchase to start building your savings history."
          />
        ) : (
          <div className="list">
            {events.map((e) => (
              <button
                key={e.id}
                className="list-row"
                onClick={() => navigate(`/purchases/${e.purchase.id}`)}
                style={{ '--row-accent': categoryColor(e.purchase.category) }}
              >
                <Thumb purchase={e.purchase} />
                <div className="list-row__main">
                  <div className="list-row__title">{e.label}</div>
                  <div className="list-row__price">{formatMoney(e.amount)}</div>
                  <div className="list-row__line">
                    {productLabel(e.purchase)} &middot; {formatDate(e.date)}
                  </div>
                </div>
                <div className="list-row__action">
                  <IconChevronRight />
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <div className="section__title">All receipts</div>
        {receipts.length === 0 ? (
          <EmptyState icon={IconDoc} title="No receipts yet" detail="Scan or add a purchase to see it here." />
        ) : (
          <div className="list">
            {receipts.map((p) => {
              const receiptPhoto = p.receiptImageUrls?.[0] || p.receiptImageUrl || null
              return (
                <button
                  key={p.id}
                  className="list-row list-row--simple"
                  onClick={() => navigate(`/purchases/${p.id}`)}
                  style={{ '--row-accent': categoryColor(p.category) }}
                >
                  {receiptPhoto ? (
                    <div className="thumb thumb--md">
                      <img src={receiptPhoto} alt="" />
                    </div>
                  ) : (
                    <Thumb purchase={p} />
                  )}
                  <div className="list-row__main">
                    <div className="list-row__title">{productLabel(p)}</div>
                    <div className="list-row__line">{formatDate(p.purchaseDate)}</div>
                  </div>
                  <div className="list-row__trailing">
                    <div className="list-row__price">{formatMoney(p.price)}</div>
                    {!receiptPhoto && <div className="list-row__line">No receipt photo</div>}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
