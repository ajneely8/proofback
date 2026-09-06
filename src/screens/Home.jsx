import { Link } from 'react-router-dom'
import { usePurchases } from '../lib/PurchasesContext.jsx'
import { useSettings } from '../lib/SettingsContext.jsx'
import { useWatchlist } from '../lib/WatchlistContext.jsx'
import {
  getNeedsAttention,
  getDashboardStats,
  getTotalDiscountSaved,
  formatMoney,
  formatDate,
  productLabel,
} from '../lib/derive.js'
import { IconPlus, IconChevronRight, IconCheck } from '../components/Icons.jsx'
import Thumb from '../components/Thumb.jsx'
import RadialProgress from '../components/RadialProgress.jsx'
import EmptyState from '../components/EmptyState.jsx'

export default function Home() {
  const { purchases } = usePurchases()
  const { settings } = useSettings()
  const { items: watchlistItems } = useWatchlist()
  const needsAttention = getNeedsAttention(purchases, settings)
  const stats = getDashboardStats(purchases, settings)
  const discountSaved = getTotalDiscountSaved(purchases)
  const watchlistHits = watchlistItems.filter((i) => i.lastSeenPrice != null && i.lastSeenPrice <= i.targetPrice)

  return (
    <div className="screen">
      <div className="page-header">
        <div className="page-header__brand">
          <span className="brand-icon" />
          <span><span className="brand-word">Proof</span><span className="brand-word brand-word--accent">Back</span></span>
        </div>
      </div>

      <section className="summary">
        <div className="summary__label">Money you could still recover</div>
        <div className="summary__amount">{formatMoney(stats.recoverable)}</div>
        <div className="summary__hint">Across returns, price adjustments, and missing refunds</div>
      </section>

      {stats.recovered > 0 && (
        <div className="stat-pill">
          <div className="stat-pill__body">
            <div className="stat-pill__label">Money recovered</div>
            <div className="stat-pill__amount">{formatMoney(stats.recovered)}</div>
          </div>
        </div>
      )}

      <div className="dashboard-grid">
        <div className="dashboard-tile">
          <div className="dashboard-tile__value">{stats.totalPurchases}</div>
          <div className="dashboard-tile__label">Total purchases</div>
        </div>
        <div className="dashboard-tile">
          <div className="dashboard-tile__value">{formatMoney(stats.totalSpent)}</div>
          <div className="dashboard-tile__label">Total spent</div>
        </div>
        <div className="dashboard-tile">
          <div className="dashboard-tile__value">{stats.eligibleForReturn}</div>
          <div className="dashboard-tile__label">Eligible for return</div>
        </div>
        <div className="dashboard-tile">
          <div className="dashboard-tile__value">{stats.upcomingReturnDeadlines}</div>
          <div className="dashboard-tile__label">Deadlines in 30 days</div>
        </div>
        <div className="dashboard-tile">
          <div className="dashboard-tile__value">{stats.activeWarranties}</div>
          <div className="dashboard-tile__label">Active warranties</div>
        </div>
        <div className="dashboard-tile">
          <div className="dashboard-tile__value">{stats.warrantiesExpiringSoon}</div>
          <div className="dashboard-tile__label">Warranties expiring soon</div>
        </div>
      </div>

      {discountSaved > 0 && (
        <div className="stat-pill">
          <div className="stat-pill__body">
            <div className="stat-pill__label">Saved from discounts</div>
            <div className="stat-pill__amount">{formatMoney(discountSaved)}</div>
          </div>
        </div>
      )}

      {watchlistHits.length > 0 && (
        <Link to="/watchlist" className="stat-pill stat-pill--link">
          <div className="stat-pill__body">
            <div className="stat-pill__label">Watchlist</div>
            <div className="stat-pill__amount">
              {watchlistHits.length} item{watchlistHits.length === 1 ? '' : 's'} hit your target price
            </div>
          </div>
          <IconChevronRight />
        </Link>
      )}

      <div className="action-row">
        <Link to="/add" className="btn btn--primary btn--block">
          <IconPlus />
          Add Purchase
        </Link>
      </div>

      <section className="section">
        <div className="section__title">Needs attention</div>

        {needsAttention.length === 0 ? (
          <EmptyState
            icon={IconCheck}
            title="Nothing needs your attention"
            detail="Return windows, warranties, and refunds are all caught up."
          />
        ) : (
          <div className="list">
            {needsAttention.map((item) => (
              <Link to={`/purchases/${item.purchase.id}`} key={item.id} className="list-row">
                <Thumb purchase={item.purchase} />
                <div className="list-row__main">
                  <div className="list-row__title">{item.label}</div>
                  <div className="list-row__price">{formatMoney(item.purchase.price)}</div>
                  <div className={'list-row__line' + (item.urgent ? ' is-urgent' : '')}>
                    {item.primaryText}
                  </div>
                  {item.secondaryText && (
                    <div className="list-row__line list-row__line--accent">{item.secondaryText}</div>
                  )}
                </div>
                <div className="list-row__action list-row__action--stacked">
                  {item.daysLeft != null && (
                    <RadialProgress daysLeft={item.daysLeft} windowDays={item.windowDays} urgent={item.urgent} />
                  )}
                  <span className="list-row__view">
                    View
                    <IconChevronRight />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {stats.recentlyAdded.length > 0 && (
        <section className="section">
          <div className="section__title">Recently added</div>
          <div className="list">
            {stats.recentlyAdded.map((p) => (
              <Link to={`/purchases/${p.id}`} key={p.id} className="list-row list-row--simple">
                <Thumb purchase={p} />
                <div className="list-row__main">
                  <div className="list-row__title">{productLabel(p)}</div>
                  <div className="list-row__line">{p.store}</div>
                </div>
                <div className="list-row__trailing">
                  <div className="list-row__price">{formatMoney(p.price)}</div>
                  <div className="list-row__line">{formatDate(p.purchaseDate)}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
