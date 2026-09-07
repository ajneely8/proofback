import { Link, useNavigate } from 'react-router-dom'
import { usePurchases } from '../lib/PurchasesContext.jsx'
import { formatMoney, productLabel } from '../lib/derive.js'
import { IconChevronLeft, IconList } from '../components/Icons.jsx'
import Thumb from '../components/Thumb.jsx'
import EmptyState from '../components/EmptyState.jsx'

// "What I Own" — the same purchases the rest of the app already tracks,
// just re-listed product-first (one row per owned item, sorted newest
// first) instead of receipt-first. Tapping through goes to the same
// Purchase Passport (/purchases/:id) that already shows everything this
// view would otherwise need to duplicate: date, store, price, receipt,
// warranty, return status, model/serial number, and notes.
export default function MyProducts() {
  const navigate = useNavigate()
  const { purchases } = usePurchases()

  const sorted = [...purchases].sort((a, b) => (a.purchaseDate < b.purchaseDate ? 1 : -1))

  return (
    <div className="screen">
      <button className="back-link" onClick={() => navigate(-1)}>
        <IconChevronLeft />
        Back
      </button>

      <div className="page-header">
        <h1>What I Own</h1>
        <p className="page-header__sub">Every product ProofBack has on record for you.</p>
      </div>

      {sorted.length === 0 ? (
        <EmptyState icon={IconList} title="Nothing here yet" detail="Scan or add a purchase to start your product list." />
      ) : (
        <div className="list">
          {sorted.map((p) => (
            <Link to={`/purchases/${p.id}`} key={p.id} className="list-row list-row--simple">
              <Thumb purchase={p} />
              <div className="list-row__main">
                <div className="list-row__title">{productLabel(p)}</div>
                <div className="list-row__line">Purchased {p.purchaseDate?.slice(0, 4)}</div>
              </div>
              <div className="list-row__trailing">
                <div className="list-row__price">{formatMoney(p.price)}</div>
                <div className="list-row__line">{p.store}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
