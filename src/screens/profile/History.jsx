import { useNavigate } from 'react-router-dom'
import { usePurchases } from '../../lib/PurchasesContext.jsx'
import { getSavingsEvents, getTotalSaved, formatDate, formatMoney } from '../../lib/derive.js'
import { IconChevronLeft, IconChevronRight } from '../../components/Icons.jsx'
import Thumb from '../../components/Thumb.jsx'

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

      <section className="summary summary--compact">
        <div className="summary__label">Saved over time</div>
        <div className="summary__amount">{formatMoney(totalSaved)}</div>
        <div className="summary__hint">
          From {events.length} confirmed return{events.length === 1 ? '' : 's'}, refund{events.length === 1 ? '' : 's'}, and price adjustment{events.length === 1 ? '' : 's'}
        </div>
      </section>

      <section className="section">
        <div className="section__title">Savings timeline</div>
        {events.length === 0 ? (
          <p className="empty-note">
            Nothing confirmed yet — mark a return complete, a refund received, or a price adjustment
            applied on a purchase to start building your savings history.
          </p>
        ) : (
          <div className="list">
            {events.map((e) => (
              <button
                key={e.id}
                className="list-row"
                onClick={() => navigate(`/purchases/${e.purchase.id}`)}
              >
                <Thumb purchase={e.purchase} />
                <div className="list-row__main">
                  <div className="list-row__title">{e.label}</div>
                  <div className="list-row__price">{formatMoney(e.amount)}</div>
                  <div className="list-row__line">
                    {e.purchase.brand} {e.purchase.product} &middot; {formatDate(e.date)}
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
        <div className="list">
          {receipts.map((p) => {
            const receiptPhoto = p.receiptImageUrls?.[0] || p.receiptImageUrl || null
            return (
              <button key={p.id} className="list-row list-row--simple" onClick={() => navigate(`/purchases/${p.id}`)}>
                {receiptPhoto ? (
                  <div className="thumb thumb--md">
                    <img src={receiptPhoto} alt="" />
                  </div>
                ) : (
                  <Thumb purchase={p} />
                )}
                <div className="list-row__main">
                  <div className="list-row__title">{p.brand} {p.product}</div>
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
      </section>
    </div>
  )
}
