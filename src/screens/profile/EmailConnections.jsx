import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSettings } from '../../lib/SettingsContext.jsx'
import { IconChevronLeft, IconCheck } from '../../components/Icons.jsx'

export default function EmailConnections() {
  const { settings, updateSettings } = useSettings()
  const navigate = useNavigate()
  const [email, setEmail] = useState(settings.connectedEmail)
  const [saved, setSaved] = useState(false)

  function save() {
    updateSettings({ connectedEmail: email.trim() })
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="screen">
      <button className="back-link" onClick={() => navigate(-1)}>
        <IconChevronLeft />
        Back
      </button>

      <div className="page-header">
        <h1>Email connections</h1>
        <p className="page-header__sub">
          Email delivery isn't connected yet. Save the address you'd like alerts sent to once it is.
        </p>
      </div>

      <section className="detail-card">
        <div className="field-row">
          <label>Alert email</label>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      </section>

      <button className="btn btn--primary btn--block" onClick={save}>
        {saved ? (
          <>
            <IconCheck width={16} height={16} />
            Saved
          </>
        ) : (
          'Save'
        )}
      </button>
    </div>
  )
}
