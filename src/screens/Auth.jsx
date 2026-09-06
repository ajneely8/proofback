import { useState } from 'react'
import { useAuth } from '../lib/AuthContext.jsx'
import { isSupabaseConfigured } from '../lib/supabaseClient.js'

const ERROR_MESSAGES = {
  'Invalid login credentials': 'Incorrect email or password.',
  'Email not confirmed': 'Check your email and confirm your address before logging in.',
  'User already registered': 'An account with that email already exists — try logging in instead.',
}

export default function Auth() {
  const { signIn, signUp, resendVerification } = useAuth()
  const [mode, setMode] = useState('login') // login | signup | verify
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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

  if (mode === 'verify') {
    return (
      <div className="screen auth-screen">
        <div className="auth-screen__mark">
          <span className="brand-icon" />
          <span><span className="brand-word">Proof</span><span className="brand-word brand-word--accent">Back</span></span>
        </div>
        <h1>Check your email</h1>
        <p className="page-header__sub">
          We sent a verification link to <strong>{email}</strong>. Click it, then come back and log in.
        </p>
        <button className="btn btn--primary btn--block" onClick={() => setMode('login')} style={{ marginTop: 16 }}>
          Back to Log In
        </button>
        <button className="link-action" onClick={handleResend} disabled={resendStatus === 'sending'}>
          {resendStatus === 'sent' ? 'Sent again — check your inbox' : 'Resend verification email'}
        </button>
        {resendStatus === 'error' && <p className="field-hint">Couldn't resend right now. Try again shortly.</p>}
      </div>
    )
  }

  return (
    <div className="screen auth-screen">
      <div className="auth-screen__mark">
        <span className="brand-icon" />
        <span><span className="brand-word">Proof</span><span className="brand-word brand-word--accent">Back</span></span>
      </div>

      <h1>{mode === 'login' ? 'Log in' : 'Create an account'}</h1>
      <p className="page-header__sub">
        {mode === 'login'
          ? 'Your purchases, synced to your account.'
          : "We'll send a verification link before you can log in."}
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
