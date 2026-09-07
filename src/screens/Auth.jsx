import { useState } from 'react'
import { useAuth } from '../lib/AuthContext.jsx'
import { isSupabaseConfigured } from '../lib/supabaseClient.js'

const ERROR_MESSAGES = {
  'Invalid login credentials': 'Incorrect email or password.',
  'Email not confirmed': 'Check your email and confirm your address before logging in.',
  'User already registered': 'An account with that email already exists — try logging in instead.',
  'Token has expired or is invalid': "That code is wrong or has expired — check for a newer email, or resend it.",
}

export default function Auth({ reason }) {
  const { signIn, signUp, resendVerification, verifySignupCode } = useAuth()
  const [mode, setMode] = useState(reason ? 'signup' : 'login') // login | signup | verify
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [resendStatus, setResendStatus] = useState(null)

  if (!isSupabaseConfigured) {
    return (
      <div className="screen auth-screen">
        <div className="auth-screen__mark">
          <span className="brand-icon" />
          <span><span className="brand-word">Proof</span><span className="brand-word brand-word--accent">Back</span></span>
        </div>
        <div className="missing-fields-note">
          Accounts aren't set up yet — the server is missing its Supabase configuration
          (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).
        </div>
      </div>
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const result = mode === 'login' ? await signIn(email, password) : await signUp(email, password)
    setBusy(false)

    if (result.error) {
      setError(ERROR_MESSAGES[result.error.message] || result.error.message)
      return
    }

    if (mode === 'signup') {
      setMode('verify')
    }
  }

  async function handleResend() {
    setResendStatus('sending')
    const { error } = await resendVerification(email)
    setResendStatus(error ? 'error' : 'sent')
  }

  async function handleVerify(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const { error } = await verifySignupCode(email, code.trim())
    setBusy(false)
    if (error) {
      setError(ERROR_MESSAGES[error.message] || error.message)
      return
    }
    // A successful verifyOtp already signs the user in with a real session —
    // AuthContext's onAuthStateChange picks it up on its own, so there's
    // nothing left to navigate; the app moves past this screen by itself.
  }

  if (mode === 'verify') {
    return (
      <div className="screen auth-screen">
        <div className="auth-screen__mark">
          <span className="brand-icon" />
          <span><span className="brand-word">Proof</span><span className="brand-word brand-word--accent">Back</span></span>
        </div>
        <h1>Enter your code</h1>
        <p className="page-header__sub">
          We sent a 6-digit verification code to <strong>{email}</strong>. Enter it below to finish creating your
          account.
        </p>

        <form className="auth-form" onSubmit={handleVerify}>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            maxLength={6}
            autoFocus
            required
            style={{ textAlign: 'center', fontSize: 22, letterSpacing: '0.3em' }}
          />
          {error && <p className="field-hint">{error}</p>}
          <button className="btn btn--primary btn--block" type="submit" disabled={busy || code.length < 6}>
            {busy ? 'Verifying…' : 'Verify'}
          </button>
        </form>

        <button className="link-action" onClick={handleResend} disabled={resendStatus === 'sending'}>
          {resendStatus === 'sent' ? 'Sent again — check your inbox' : 'Resend code'}
        </button>
        {resendStatus === 'error' && <p className="field-hint">Couldn't resend right now. Try again shortly.</p>}
        <button className="link-action link-action--inline" onClick={() => setMode('login')}>
          Back to Log In
        </button>
      </div>
    )
  }

  return (
    <div className="screen auth-screen">
      <div className="auth-screen__mark">
        <span className="brand-icon" />
        <span><span className="brand-word">Proof</span><span className="brand-word brand-word--accent">Back</span></span>
      </div>

      {reason && (
        <p className="field-hint field-hint--block" style={{ color: 'var(--accent-navy)', margin: '0 0 12px' }}>
          {reason}
        </p>
      )}

      <h1>{mode === 'login' ? 'Log in' : 'Create an account'}</h1>
      <p className="page-header__sub">
        {mode === 'login'
          ? 'Your purchases, synced to your account.'
          : "We'll email you a verification code before your account is ready."}
      </p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          minLength={6}
          required
        />
        {error && <p className="field-hint">{error}</p>}
        <button className="btn btn--primary btn--block" type="submit" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'login' ? 'Log In' : 'Sign Up'}
        </button>
      </form>

      <button
        className="link-action"
        onClick={() => {
          setMode(mode === 'login' ? 'signup' : 'login')
          setError(null)
        }}
      >
        {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
      </button>
    </div>
  )
}
