import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSettings } from '../../lib/SettingsContext.jsx'
import { IconChevronLeft, IconCheck } from '../../components/Icons.jsx'

export default function Account() {
  const { settings, updateSettings } = useSettings()
  const navigate = useNavigate()
  const [name, setName] = useState(settings.name)
  const [email, setEmail] = useState(settings.email)
  const [saved, setSaved] = useState(false)

  function save() {
    updateSettings({ name: name.trim(), email: email.trim() })
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
        <h1>Account</h1>
      </div>

      <section className="detail-card">
        <div className="field-row">
          <label>Name</label>
          <input type="text" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field-row">
          <label>Email</label>
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
          'Save Changes'
        )}
      </button>
    </div>
  )
}
