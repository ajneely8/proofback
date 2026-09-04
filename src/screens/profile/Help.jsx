import { useNavigate } from 'react-router-dom'
import { IconChevronLeft } from '../../components/Icons.jsx'

const FAQS = [
  {
    q: 'How does receipt scanning work?',
    a: "A photo of your receipt is read by Google's Gemini AI to pull out the store, item, price, and purchase date. You can edit any field before saving.",
  },
  {
    q: 'Where do return and warranty dates come from?',
    a: "ProofBack applies typical category defaults (for example, a 30-day return window for apparel) since it can't look up a specific retailer's real policy. Adjust the dates on the review screen if you know your item's actual terms.",
  },
  {
    q: 'Is the product photo the exact item I bought?',
    a: "No — it's a representative stock photo found from a short description of your item, not a photo of the specific unit you purchased.",
  },
  {
    q: 'What happens if I clear my browser data?',
    a: 'Your tracked purchases are stored on this device only, so clearing site data or switching devices will remove them.',
  },
]

export default function Help() {
  const navigate = useNavigate()

  return (
    <div className="screen">
      <button className="back-link" onClick={() => navigate(-1)}>
        <IconChevronLeft />
        Back
      </button>

      <div className="page-header">
        <h1>Help</h1>
      </div>

      <div className="list">
        {FAQS.map(({ q, a }) => (
          <div className="faq-row" key={q}>
            <div className="faq-row__q">{q}</div>
            <div className="faq-row__a">{a}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
