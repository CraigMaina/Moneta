import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'

/**
 * Email sign-in — the v1 email path (PRD F1). Two steps, buttons + handlers
 * only (no HTML `<form>`, per CLAUDE.md). Step 1 sends a magic link + 6-digit
 * code via `signInWithOtp`; step 2 verifies the code with `verifyOtp`. Clicking
 * the emailed link also signs in (the Supabase client's `detectSessionInUrl`
 * handles the redirect), so the code entry is a convenience, not the only path.
 *
 * Voice: warm, plain, no jargon. Moneta warns and remembers; sign-in is calm.
 */
export function SignIn() {
  const { showToast } = useToast()
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  async function sendLink() {
    if (!emailValid) return
    setSending(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    })
    setSending(false)
    if (error) {
      showToast({ title: "Couldn't send the email", description: error.message, variant: 'warn' })
      return
    }
    setStep('code')
  }

  async function verify() {
    const token = code.trim()
    if (token.length < 6) return
    setVerifying(true)
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token, type: 'email' })
    setVerifying(false)
    if (error) {
      showToast({ title: "That code didn't work", description: 'Check the email and try again.', variant: 'warn' })
      return
    }
    // On success, onAuthStateChange flips the session and the gate renders the app.
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-paper-0 px-6">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-[40px] font-semibold leading-none text-coral-600">Moneta</h1>
        <p className="mt-3 text-[15px] text-ink-600">Know what you can safely spend today.</p>

        {step === 'email' ? (
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
                if (event.key === 'Enter') sendLink()
              }}
              placeholder="you@example.com"
              className="mt-2 h-12 w-full rounded-card bg-paper-50 px-4 text-[15px] text-ink-900 placeholder:text-ink-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600"
            />
            <Button
              variant="primary"
              size="lg"
              fullWidth
              className="mt-4"
              disabled={!emailValid}
              loading={sending}
              onClick={sendLink}
            >
              Email me a link
            </Button>
            <p className="mt-3 text-center text-[12.5px] text-ink-600">
              We&apos;ll send a link and a 6-digit code. No password to remember.
            </p>
          </div>
        ) : (
          <div className="mt-8">
            <p className="text-[15px] text-ink-900">
              Check <span className="font-semibold">{email.trim()}</span> — tap the link, or enter the 6-digit code.
            </p>
            <label htmlFor="signin-code" className="mt-6 block text-[12.5px] font-semibold uppercase tracking-wide text-ink-600">
              6-digit code
            </label>
            <input
              id="signin-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(event) => {
                if (event.key === 'Enter') verify()
              }}
              placeholder="000000"
              className="mt-2 h-12 w-full rounded-card bg-paper-50 px-4 text-center text-[20px] font-semibold tracking-[0.3em] tabular-nums text-ink-900 placeholder:text-ink-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600"
            />
            <Button
              variant="primary"
              size="lg"
              fullWidth
              className="mt-4"
              disabled={code.trim().length < 6}
              loading={verifying}
              onClick={verify}
            >
              Verify and continue
            </Button>
            <Button variant="ghost" fullWidth className="mt-2" onClick={() => setStep('email')}>
              Use a different email
            </Button>
          </div>
        )}
      </div>
    </main>
  )
}
