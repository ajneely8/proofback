import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { usePurchases } from '../lib/PurchasesContext.jsx'
import { useSettings } from '../lib/SettingsContext.jsx'
import {
  getRecoveryCases,
  getRecoverableTotal,
  getYourImpact,
  getWarrantyState,
  getAlerts,
  getDashboardStats,
  getPriceWatchItems,
  getPriceWatchSummary,
  groupCasesByReceipt,
  caseActionLabel,
  formatMoney,
  formatDate,
  productLabel,
  refundMissing,
  returnIsOpen,
  getPurchaseStatuses,
  getReceiptHealth,
  groupByReceipt,
  parseSearchQuery,
  applySearchFilter,
} from '../lib/derive.js'
import { IconPlus, IconCheck, IconCamera, IconSearch, IconList } from '../components/Icons.jsx'
import Thumb from '../components/Thumb.jsx'
import EmptyState from '../components/EmptyState.jsx'

const FILTERS = [
  'All',
  'Recovery Cases',
  'Returns',
  'Refunds',
  'Active',
  'Expiring Soon',
  'Expired',
  'Not Confirmed',
  'No Warranty Expected',
]

function StatusDot({ purchase, settings }) {
  const health = getReceiptHealth(purchase, settings)
  return <span className={`status-dot status-dot--${health.status}`} title={health.message} />
}

const WARRANTY_FILTER_STATES = {
  Active: 'active',
  'Expiring Soon': 'expiring_soon',
  Expired: 'expired',
  'Not Confirmed': 'not_confirmed',
  'No Warranty Expected': 'none',
}

export default function Home() {
  const navigate = useNavigate()
  const { purchases, deletePurchases } = usePurchases()
  const { settings } = useSettings()
  const [searchParams] = useSearchParams()

  // Recoverable Now is specifically about money — exchange opportunities
  // (amount always $0, since nothing's being recovered) belong in the
  // eligibility engine generally but would look like a broken $0.00 row
  // here, so they're left out of this particular list.
  const cases = getRecoveryCases(purchases, settings).filter((c) => c.status !== 'closed' && c.type !== 'exchange')
  // Multiple line items scanned off the same receipt (e.g. a 9-item fast
  // food order) show up here as one combined row rather than 9 near-
  // identical ones — same receipt-grouping logic used across the app.
  const caseGroups = groupCasesByReceipt(cases)
  const recoverableTotal = getRecoverableTotal(purchases, settings)
  const impact = getYourImpact(purchases)
  const activeWarranties = purchases.filter((p) => getWarrantyState(p, settings) === 'active').length
  const warrantiesExpiringSoon = purchases.filter((p) => getWarrantyState(p, settings) === 'expiring_soon').length
  const greeting = (() => {
    const hour = new Date().getHours()
    return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  })()
  const namedAlerts = getAlerts(purchases, settings)
    .filter((a) => a.urgent || (a.daysLeft != null && a.daysLeft <= 7))
    .slice(0, 3)
  const recentPurchases = getDashboardStats(purchases, settings).recentlyAdded
  const priceWatchSummary = getPriceWatchSummary(getPriceWatchItems(purchases))

  // The full, searchable/filterable purchase list — merged in from what
  // used to be its own "Purchases" screen/tab, now that the bottom nav's
  // former Purchases slot points at Price Finder instead (see
  // BottomNav.jsx). Everything below this comment is that list's own
  // state and logic, unchanged.
  const [filter, setFilter] = useState(() => {
    const fromUrl = searchParams.get('filter')
    return FILTERS.includes(fromUrl) ? fromUrl : 'All'
  })
  const [query, setQuery] = useState('')
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState(new Set())

  const smartSearch = useMemo(() => {
    if (!query.trim()) return null
    return parseSearchQuery(query, purchases)
  }, [query, purchases])

  const filtered = useMemo(() => {
    let list = purchases
    if (filter === 'Recovery Cases') {
      const openCaseIds = new Set(
        getRecoveryCases(purchases, settings)
          .filter((c) => c.status !== 'closed')
          .map((c) => c.purchase.id)
      )
      list = list.filter((p) => openCaseIds.has(p.id))
    }
    if (filter === 'Returns') list = list.filter(returnIsOpen)
    if (filter === 'Refunds') list = list.filter(refundMissing)
    if (WARRANTY_FILTER_STATES[filter]) {
      list = list.filter((p) => getWarrantyState(p, settings) === WARRANTY_FILTER_STATES[filter])
    }

    if (query.trim()) {
      const q = query.trim().toLowerCase()
      const plainMatches = list.filter((p) => {
        const statusText = getPurchaseStatuses(p, settings).map((s) => s.label.toLowerCase()).join(' ')
        const fields = [
          p.product,
          p.brand,
          p.store,
          p.category,
          p.receiptNumber,
          p.orderNumber,
          p.serialNumber,
          p.notes,
          p.purchaseDate,
          p.returnDeadline,
          p.warrantyExpires,
          p.price != null ? String(p.price) : null,
          statusText,
        ]
        return fields.some((f) => f && String(f).toLowerCase().includes(q))
      })
      // "Find My Purchase": a natural-language-ish query ("show me
      // everything I bought at Walmart", "this year", "still returnable")
      // often matches nothing with a plain substring search — fall back to
      // the parsed structured filter in that case rather than showing
      // "no purchases match" for something the user's own data can answer.
      // Only worth falling back to when the parse actually recognized
      // something — an all-null filter (a query with no store/category/
      // date/keyword signal at all) would otherwise match every purchase,
      // turning "no results" into "show everything" for a typo'd search.
      const smartSearchActive =
        smartSearch &&
        (smartSearch.store || smartSearch.category || smartSearch.dateFrom || smartSearch.dateTo || smartSearch.returnOpenOnly || smartSearch.keyword)
      list = plainMatches.length > 0 || !smartSearchActive ? plainMatches : applySearchFilter(list, smartSearch)
    }
    return list
  }, [purchases, filter, query, settings, smartSearch])

  const searchSumLine =
    query.trim() && smartSearch?.sumMode
      ? `You spent ${formatMoney(filtered.reduce((sum, p) => sum + (Number(p.price) || 0), 0))}${
          smartSearch.category ? ` on ${smartSearch.category}` : ''
        }${smartSearch.store ? ` at ${smartSearch.store}` : ''}${
          smartSearch.dateFrom?.slice(5) === '01-01' ? ` this year` : ''
        }.`
      : null

  const totalSpent = purchases.reduce((sum, p) => sum + p.price, 0)

  // Combine same-receipt items into one row, but only on the plain,
  // unfiltered/unsearched list — every other filter (warranty states,
  // "Returns", a search term) is inherently about which individual items
  // match, and grouping would hide items that don't all share the same
  // answer. Selection mode also stays per-item since bulk delete acts on
  // individual purchase ids.
  const shouldGroup = filter === 'All' && !query.trim() && !selectMode
  const groups = shouldGroup ? groupByReceipt(filtered) : null

  // The warranty tiles above used to navigate to a separate Purchases
  // screen with the filter pre-applied — now that it's the same page, set
  // the filter and scroll the list into view instead of just changing
  // state somewhere off-screen.
  function jumpToFilter(f) {
    setFilter(f)
    document.getElementById('all-purchases')?.scrollIntoView({ behavior: 'smooth' })
  }

  function toggleSelectMode() {
    setSelectMode((on) => !on)
    setSelected(new Set())
  }

  function toggleSelected(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleDeleteSelected() {
    if (!window.confirm(`Delete ${selected.size} purchase${selected.size === 1 ? '' : 's'}? This can't be undone.`)) {
      return
    }
    deletePurchases([...selected])
    setSelected(new Set())
    setSelectMode(false)
  }

  return (
    <div className="screen">
      <div className="page-header">
        <div className="home-greeting">{greeting}</div>
        <div className="page-header__brand">
          <span className="brand-icon" />
          <span><span className="brand-word">Proof</span><span className="brand-word brand-word--accent">Back</span></span>
        </div>
        <div className="brand-tagline">Scan it. Protect it. Proof it.</div>
      </div>

      <section className="summary">
        <div className="summary__label">Recoverable Now</div>
        <div className="summary__amount">{formatMoney(recoverableTotal)}</div>
        <div className="summary__hint">Across returns, missing refunds, and possible duplicate purchases</div>
      </section>

      <section className="section">
        <div className="section__title">Your Impact</div>
        <div className="dashboard-grid">
          <div className="dashboard-tile">
            <div className="dashboard-tile__value text-accent">{formatMoney(impact.totalSaved)}</div>
            <div className="dashboard-tile__label">Money saved</div>
            <div className="dashboard-tile__caption">From completed returns and received refunds</div>
          </div>
          <div className="dashboard-tile">
            <div className="dashboard-tile__value text-accent">{formatMoney(impact.totalRecovered)}</div>
            <div className="dashboard-tile__label">Money recovered</div>
            <div className="dashboard-tile__caption">Confirmed refund/return amounts</div>
          </div>
          <div className="dashboard-tile">
            <div className="dashboard-tile__value">{impact.protectedCount}</div>
            <div className="dashboard-tile__label">Purchases protected</div>
            <div className="dashboard-tile__caption">Proof Readiness of 60% or higher</div>
          </div>
          <div className="dashboard-tile">
            <div className="dashboard-tile__value">{impact.completedClaims}</div>
            <div className="dashboard-tile__label">Completed claims</div>
            <div className="dashboard-tile__caption">Returns, refunds, or cases marked resolved</div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="dashboard-grid">
          <button className="dashboard-tile" onClick={() => jumpToFilter('Active')}>
            <div className="dashboard-tile__value">{activeWarranties}</div>
            <div className="dashboard-tile__label">Active warranties</div>
          </button>
          <button className="dashboard-tile" onClick={() => jumpToFilter('Expiring Soon')}>
            <div className="dashboard-tile__value">{warrantiesExpiringSoon}</div>
            <div className="dashboard-tile__label">Warranties expiring soon</div>
          </button>
        </div>
      </section>

      {priceWatchSummary.trackedCount > 0 && (
        <Link to="/price-watch" className="price-watch-summary">
          <div>
            <div className="price-watch-summary__label">Price Watch — Potential Savings</div>
            <div className="price-watch-summary__amount">{formatMoney(priceWatchSummary.potentialSavings)}</div>
            <div className="price-watch-summary__caption">{priceWatchSummary.trackedCount} products tracked</div>
          </div>
        </Link>
      )}

      {namedAlerts.length > 0 && (
        <section className="section">
          <div className="section__title">Needs Attention</div>
          <div className="list">
            {namedAlerts.map((a) => (
              <Link to={`/purchases/${a.purchase.id}`} key={a.id} className="list-row list-row--simple">
                <Thumb purchase={a.purchase} />
                <div className="list-row__main">
                  <div className="list-row__title">{productLabel(a.purchase)}</div>
                  <div className="list-row__line">{a.message}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="action-row">
        <Link to="/add" className="btn btn--primary btn--block">
          <IconPlus />
          Add Purchase
        </Link>
      </div>

      {recentPurchases.length > 0 && (
        <section className="section">
          <div className="section__title">Recent Purchases</div>
          <div className="recent-purchases">
            {recentPurchases.map((p) => (
              <Link to={`/purchases/${p.id}`} key={p.id} className="recent-purchases__item">
                <Thumb purchase={p} size="lg" />
                <div className="recent-purchases__title">{productLabel(p)}</div>
                <div className="recent-purchases__line">{p.store}</div>
                <div className="recent-purchases__line">
                  {formatMoney(p.price)} · {formatDate(p.purchaseDate)}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {cases.length === 0 ? (
        <EmptyState
          icon={IconCheck}
          title="Nothing to recover right now"
          detail="Scan a receipt to start tracking a purchase's return window and warranty."
          action={
            <Link to="/add" className="btn btn--primary btn--small">
              <IconCamera width={16} height={16} />
              Scan Receipt
            </Link>
          }
        />
      ) : (
        <div className="list">
          {caseGroups.map((g) =>
            g.itemCount === 1 ? (
              <div className="case-row" key={g.key}>
                <Link to={`/purchases/${g.cases[0].purchase.id}`} className="case-row__top">
                  <Thumb purchase={g.cases[0].purchase} />
                  <div className="list-row__main">
                    <div className="list-row__title">{productLabel(g.cases[0].purchase)}</div>
                    <div className="list-row__line">{g.cases[0].eligibilityReason}</div>
                  </div>
                  <div className="list-row__trailing">
                    <div className="list-row__price">{formatMoney(g.cases[0].amount)}</div>
                    {g.cases[0].deadline && <div className="list-row__line">{formatDate(g.cases[0].deadline)}</div>}
                  </div>
                </Link>
                <button
                  className="btn btn--secondary btn--small btn--block case-row__action"
                  onClick={() => navigate(`/purchases/${g.cases[0].purchase.id}`)}
                >
                  {caseActionLabel(g.cases[0])}
                </button>
              </div>
            ) : (
              <div className="case-row" key={g.key}>
                <Link to={`/receipt/${encodeURIComponent(g.key)}`} className="case-row__top">
                  <Thumb purchase={g.cases[0].purchase} />
                  <div className="list-row__main">
                    <div className="list-row__title">{g.store} — {g.itemCount} items</div>
                    <div className="list-row__line">{g.opportunityCount} recovery opportunit{g.opportunityCount === 1 ? 'y' : 'ies'}</div>
                  </div>
                  <div className="list-row__trailing">
                    <div className="list-row__price">{formatMoney(g.totalAmount)}</div>
                    {g.deadline && <div className="list-row__line">{formatDate(g.deadline)}</div>}
                  </div>
                </Link>
                <button
                  className="btn btn--secondary btn--small btn--block case-row__action"
                  onClick={() => navigate(`/receipt/${encodeURIComponent(g.key)}`)}
                >
                  View Items
                </button>
              </div>
            )
          )}
        </div>
      )}

      <section className="section" id="all-purchases">
        <div className="page-header page-header--row">
          <h1>All Purchases</h1>
          <div className="page-header__actions">
            {purchases.length > 0 && (
              <button className="page-header__action" onClick={toggleSelectMode}>
                {selectMode ? 'Cancel' : 'Select'}
              </button>
            )}
            <Link to="/price-watch" className="page-header__action">
              Price Watch
            </Link>
            <Link to="/insights" className="page-header__action">
              Insights
            </Link>
          </div>
        </div>

        <section className="summary summary--compact">
          <div className="summary__label">Total spent</div>
          <div className="summary__amount">{formatMoney(totalSpent)}</div>
          <div className="summary__hint">
            Across {purchases.length} purchase{purchases.length === 1 ? '' : 's'}
          </div>
        </section>

        <div className="search-field">
          <IconSearch />
          <input
            type="text"
            placeholder="Search product, store, receipt, order #, serial #…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {searchSumLine && <p className="search-sum">{searchSumLine}</p>}

        <div className="chip-row">
          {FILTERS.map((f) => (
            <button
              key={f}
              className={'chip' + (filter === f ? ' is-active' : '')}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="list">
          {filtered.length === 0 && (
            <EmptyState
              icon={IconList}
              title="No purchases match"
              detail="Try a different filter or search term."
            />
          )}
          {shouldGroup
            ? groups.map((g) =>
                g.itemCount === 1 ? (
                  <Link to={`/purchases/${g.purchases[0].id}`} key={g.key} className="list-row list-row--simple">
                    <Thumb purchase={g.purchases[0]} />
                    <div className="list-row__main">
                      <div className="list-row__title">
                        <StatusDot purchase={g.purchases[0]} settings={settings} />
                        {productLabel(g.purchases[0])}
                      </div>
                      <div className="list-row__line">{g.purchases[0].store}</div>
                    </div>
                    <div className="list-row__trailing">
                      <div className="list-row__price">{formatMoney(g.purchases[0].price)}</div>
                      <div className="list-row__line">{formatDate(g.purchases[0].purchaseDate)}</div>
                    </div>
                  </Link>
                ) : (
                  <Link to={`/receipt/${encodeURIComponent(g.key)}`} key={g.key} className="list-row list-row--simple">
                    <Thumb purchase={g.purchases[0]} />
                    <div className="list-row__main">
                      <div className="list-row__title">{g.store} — {g.itemCount} items</div>
                      <div className="list-row__line">{formatDate(g.purchaseDate)}</div>
                    </div>
                    <div className="list-row__trailing">
                      <div className="list-row__price">{formatMoney(g.totalPrice)}</div>
                    </div>
                  </Link>
                )
              )
            : filtered.map((p) =>
                selectMode ? (
                  <button
                    key={p.id}
                    className={'list-row list-row--simple' + (selected.has(p.id) ? ' is-selected' : '')}
                    onClick={() => toggleSelected(p.id)}
                  >
                    <div className={'select-check' + (selected.has(p.id) ? ' is-checked' : '')}>
                      {selected.has(p.id) && <IconCheck width={12} height={12} />}
                    </div>
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
                ) : (
                  <Link to={`/purchases/${p.id}`} key={p.id} className="list-row list-row--simple">
                    <Thumb purchase={p} />
                    <div className="list-row__main">
                      <div className="list-row__title">
                        <StatusDot purchase={p} settings={settings} />
                        {productLabel(p)}
                      </div>
                      <div className="list-row__line">{p.store}</div>
                    </div>
                    <div className="list-row__trailing">
                      <div className="list-row__price">{formatMoney(p.price)}</div>
                      <div className="list-row__line">{formatDate(p.purchaseDate)}</div>
                    </div>
                  </Link>
                )
              )}
        </div>

        {selectMode && selected.size > 0 && (
          <div className="bulk-bar">
            <span>{selected.size} selected</span>
            <button className="btn btn--primary" onClick={handleDeleteSelected} style={{ background: 'var(--accent-warn)' }}>
              Delete
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
