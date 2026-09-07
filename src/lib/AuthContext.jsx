import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from './supabaseClient.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)

  useEffect(() => {
    if (!isSupabaseConfigured) return

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  async function signUp(email, password) {
    const { error } = await supabase.auth.signUp({ email, password })
    return { error }
  }

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  async function resendVerification(email) {
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    return { error }
  }

  // The 6-digit code Supabase's confirmation email includes alongside the
  // link — verifying it confirms the account AND signs the user in with a
  // real session in one step (onAuthStateChange above picks it up), so
  // there's no separate "now go log in" step after this succeeds.
  async function verifySignupCode(email, code) {
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'signup' })
    return { error }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user || null,
        loading,
        signUp,
        signIn,
        signOut,
        resendVerification,
        verifySignupCode,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
