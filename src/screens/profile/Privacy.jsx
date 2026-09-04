import { useNavigate } from 'react-router-dom'
import { IconChevronLeft, IconShield, IconLock, IconMail } from '../../components/Icons.jsx'

const POINTS = [
  {
    Icon: IconLock,
    title: 'Your purchases stay on this device',
    body: 'Purchase details are stored locally in your browser, not on a server ProofBack controls.',
  },
  {
    Icon: IconShield,
    title: 'Receipt photos are only used to read them',
    body: "When you scan a receipt, the photo is sent once to Claude (Anthropic's AI) to read the store, item, price, and date off it. It isn't stored afterward.",
  },
  {
    Icon: IconMail,
    title: 'Product photos come from a search, not your receipt',
    body: 'A short description built from your receipt is used to look up a representative photo on Unsplash. No personal data is sent in that search.',
  },
]

export default function Privacy() {
  const navigate = useNavigate()

  return (
    <div className="screen">
      <button className="back-link" onClick={() => navigate(-1)}>
        <IconChevronLeft />
        Back
      </button>

      <div className="page-header">
        <h1>Privacy</h1>
        <p className="page-header__sub">Your purchase information is protected.</p>
      </div>

      {POINTS.map(({ Icon, title, body }) => (
        <section className="detail-card privacy-card" key={title}>
          <Icon className="privacy-card__icon" />
          <div>
            <div className="privacy-card__title">{title}</div>
            <div className="privacy-card__body">{body}</div>
          </div>
        </section>
      ))}
    </div>
  )
}
