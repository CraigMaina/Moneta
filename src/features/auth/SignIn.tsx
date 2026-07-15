import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'

/**
 * Email + password sign-in, account creation, and password reset (PRD F1).
 * Buttons + handlers only, no HTML `<form>` (CLAUDE.md). Password auth (not the
 * earlier magic-link / OTP flow) so signing in sends no email and never hits
 * the email rate limit.
 *
 * `signInWithPassword` logs an existing user in; `signUp` creates one (with a
 * retyped-password confirm); `resetPasswordForEmail` mails a recovery link that
 * lands back on the app, where `UpdatePassword` sets the new password. If the
 * Supabase project has "Confirm email" enabled, `signUp` returns a user with no
 * session (a confirmation email is sent) and we tell the user to confirm; if
 * disabled, `signUp` returns a session and `onAuthStateChange` signs them in.
 */
type Mode = 'signin' | 'signup' | 'reset'

export function SignIn() {
  const { showToast } = useToast()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const passwordsMatch = password === confirmPassword
  // Supabase requires 6+; ask for 8+ (and a matching retype) on new accounts.
  const canSubmit =
    !submitting &&
    (mode === 'reset'
      ? emailValid
      : mode === 'signup'
        ? emailValid && password.length >= 8 && passwordsMatch
        : emailValid && password.length >= 1)

  const switchMode = (next: Mode) => {
    setMode(next)
    setPassword('')
    setConfirmPassword('')
  }

  async function submit() {
    if (!canSubmit) return
    setSubmitting(true)
    const trimmedEmail = email.trim()

    if (mode === 'reset') {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: window.location.origin,
      })
      setSubmitting(false)
      if (error) {
        showToast({ title: "Couldn't send the reset email", description: error.message, variant: 'warn' })
        return
      }
      showToast({ title: 'Check your email', description: 'We sent a link to reset your password.', variant: 'success' })
      switchMode('signin')
      return
    }

    const credentials = { email: trimmedEmail, password }

    if (mode === 'signup') {
      // emailRedirectTo so the confirmation link returns to wherever they signed
      // up from (localhost in dev, the deployed origin in prod) instead of only
      // the project's fixed Site URL. Both origins must be in Supabase's
      // Redirect URLs allowlist.
      const { data, error } = await supabase.auth.signUp({
        ...credentials,
        options: { emailRedirectTo: window.location.origin },
      })
      setSubmitting(false)
      if (error) {
        const already = /already registered|already exists/i.test(error.message)
        showToast({
          title: already ? 'That email already has an account' : "Couldn't create your account",
          description: already ? 'Try signing in instead.' : error.message,
          variant: 'warn',
        })
        if (already) switchMode('signin')
        return
      }
      // Session present = confirmation is off, onAuthStateChange takes over.
      // No session = a confirmation email was sent; nudge the user to confirm.
      if (!data.session) {
        showToast({
          title: 'Account created',
          description: 'Check your email to confirm, then sign in.',
          variant: 'success',
        })
        switchMode('signin')
      }
      return
    }

    const { error } = await supabase.auth.signInWithPassword(credentials)
    setSubmitting(false)
    if (error) {
      const badCreds = /invalid login credentials/i.test(error.message)
      showToast({
        title: badCreds ? 'Email or password is incorrect' : "Couldn't sign you in",
        description: badCreds ? 'Check them and try again.' : error.message,
        variant: 'warn',
      })
    }
    // On success, onAuthStateChange flips the session and the gate renders the app.
  }

  const submitLabel = mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Send reset link' : 'Sign in'
  const showMismatch = mode === 'signup' && confirmPassword.length > 0 && !passwordsMatch

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-paper-0 px-6">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-[40px] font-semibold leading-none text-coral-600">Moneta</h1>
        <p className="mt-3 text-[15px] text-ink-600">
          {mode === 'reset' ? 'Reset your password.' : 'Know what you can safely spend today.'}
        </p>

        <div className="mt-8">
          <label htmlFor="signin-email" className="block text-[12.5px] font-semibold uppercase tracking-wide text-ink-600">
            Email
          </label>
          <input
            id="signin-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && mode === 'reset') submit()
            }}
            placeholder="you@example.com"
            className="mt-2 h-12 w-full rounded-card bg-paper-50 px-4 text-[15px] text-ink-900 placeholder:text-ink-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600"
          />

          {mode !== 'reset' && (
            <>
              <label htmlFor="signin-password" className="mt-4 block text-[12.5px] font-semibold uppercase tracking-wide text-ink-600">
                Password
              </label>
              <div className="relative mt-2">
                <input
                  id="signin-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') submit()
                  }}
                  placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'}
                  className="h-12 w-full rounded-card bg-paper-50 pl-4 pr-16 text-[15px] text-ink-900 placeholder:text-ink-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-[13px] font-semibold text-ink-600 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </>
          )}

          {mode === 'signup' && (
            <>
              <label htmlFor="signin-confirm" className="mt-4 block text-[12.5px] font-semibold uppercase tracking-wide text-ink-600">
                Confirm password
              </label>
              <input
                id="signin-confirm"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') submit()
                }}
                placeholder="Retype your password"
                className="mt-2 h-12 w-full rounded-card bg-paper-50 px-4 text-[15px] text-ink-900 placeholder:text-ink-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600"
              />
              {showMismatch && <p className="mt-2 text-[12.5px] text-coral-600">Passwords don&apos;t match.</p>}
            </>
          )}

          <Button
            variant="primary"
            size="lg"
            fullWidth
            className="mt-5"
            disabled={!canSubmit}
            loading={submitting}
            onClick={submit}
          >
            {submitLabel}
          </Button>

          {mode === 'signin' && (
            <p className="mt-4 text-center">
              <button
                type="button"
                onClick={() => switchMode('reset')}
                className="text-[13px] font-semibold text-coral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600"
              >
                Forgot password?
              </button>
            </p>
          )}

          {mode === 'reset' ? (
            <p className="mt-4 text-center text-[13px] text-ink-600">
              Remembered it?{' '}
              <button
                type="button"
                onClick={() => switchMode('signin')}
                className="font-semibold text-coral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600"
              >
                Back to sign in
              </button>
            </p>
          ) : (
            <p className={`${mode === 'signin' ? 'mt-2' : 'mt-4'} text-center text-[13px] text-ink-600`}>
              {mode === 'signup' ? 'Already have an account?' : 'New to Moneta?'}{' '}
              <button
                type="button"
                onClick={() => switchMode(mode === 'signup' ? 'signin' : 'signup')}
                className="font-semibold text-coral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600"
              >
                {mode === 'signup' ? 'Sign in' : 'Create an account'}
              </button>
            </p>
          )}
        </div>
      </div>
    </main>
  )
}
