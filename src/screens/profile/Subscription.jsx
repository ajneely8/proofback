import { useNavigate } from 'react-router-dom'
import { IconChevronLeft } from '../../components/Icons.jsx'

export default function Subscription() {
  const navigate = useNavigate()

  return (
    <div className="screen">
      <button className="back-link" onClick={() => navigate(-1)}>
        <IconChevronLeft />
        Back
      </button>

      <div className="page-header">
        <h1>Subscription</h1>
      </div>

      <section className="detail-card">
        <div className="detail-card__label">Current plan</div>
        <div className="detail-card__row">
          <span>Plan</span>
          <strong>Free</strong>
        </div>
      </section>

      <p className="empty-note">
        Everything in ProofBack is free while it's in early development. Paid plans aren't available yet.
      </p>
    </div>
  )
}
