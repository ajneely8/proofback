import { useNavigate, useParams, Link } from 'react-router-dom'
import { usePurchases } from '../lib/PurchasesContext.jsx'
import { useSettings } from '../lib/SettingsContext.jsx'
import {
  getReceiptGroupKey,
  getRecoveryCases,
  caseActionLabel,
  formatMoney,
  formatDate,
  productLabel,
} from '../lib/derive.js'
import { IconChevronLeft, IconChevronRight } from '../components/Icons.jsx'
import Thumb from '../components/Thumb.jsx'

// The combined view behind a "Store — N items" row anywhere purchases are
// grouped by receipt (Home, Purchases). Each item still links to its own
// full Purchase Passport — this page is just the "what was on this
// receipt" rollup, not a replacement for the per-item detail screen.
export default function ReceiptGroup() {
  const navigate = useNavigate()
  const { groupKey } = useParams()
  const { purchases } = usePurchases()
  const { settings } = useSettings()

  const key = decodeURIComponent(groupKey)
  const items = purchases.filter((p) => getReceiptGroupKey(p) === key)
  const cases = getRecoveryCases(purchases, settings).filter((c) => items.some((p) => p.id === c.purchase.id))
  const casesByPurchaseId = new Map(cases.map((c) => [c.purchase.id, c]))

  if (items.length === 0) {
    return (
      <div className="screen">
        <button className="back-link" onClick={() => navigate(-1)}>
          <IconChevronLeft />
          Back
        </button>
        <p className="field-hint field-hint--block">This receipt isn't in your purchases anymore.</p>
      </div>
    )
  }

  const totalPrice = Math.round(items.reduce((sum, p) => sum + (Number(p.price) || 0), 0) * 100) / 100

  return (
    <div className="screen">
      <button className="back-link" onClick={() => navigate(-1)}>
        <IconChevronLeft />
        Back
      </button>

      <div className="page-header">
        <div className="page-header__brand" style={{ gap: 10 }}>
          <Thumb purchase={items[0]} />
          <div>
            <h1 style={{ marginBottom: 2 }}>{items[0].store}</h1>
            <p className="page-header__sub" style={{ margin: 0 }}>
              {formatDate(items[0].purchaseDate)} · {items.length} item{items.length === 1 ? '' : 's'} ·{' '}
              {formatMoney(totalPrice)}
            </p>
          </div>
        </div>
      </div>

      <div className="list">
        {items.map((p) => {
          const c = casesByPurchaseId.get(p.id)
          return (
            <div className="case-row" key={p.id}>
              <Link to={`/purchases/${p.id}`} className="case-row__top">
                <Thumb purchase={p} />
                <div className="list-row__main">
                  <div className="list-row__title">{productLabel(p)}</div>
                  {c && <div className="list-row__line">{c.eligibilityReason}</div>}
                </div>
                <div className="list-row__trailing">
                  <div className="list-row__price">{formatMoney(p.price)}</div>
                  <IconChevronRight width={16} height={16} />
                </div>
              </Link>
              {c && (
                <button
                  className="btn btn--secondary btn--small btn--block case-row__action"
                  onClick={() => navigate(`/purchases/${p.id}`)}
                >
                  {caseActionLabel(c)}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
