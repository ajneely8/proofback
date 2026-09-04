import { useNavigate } from 'react-router-dom'
import { IconChevronLeft } from '../../components/Icons.jsx'

export default function Terms() {
  const navigate = useNavigate()

  return (
    <div className="screen">
      <button className="back-link" onClick={() => navigate(-1)}>
        <IconChevronLeft />
        Back
      </button>

      <div className="page-header">
        <h1>Terms</h1>
      </div>

      <p className="empty-note">
        ProofBack is a prototype in early development and doesn't yet have finished Terms of Service.
        This screen is a placeholder — replace it with real terms before this app is published or used
        with real customer data.
      </p>
    </div>
  )
}
