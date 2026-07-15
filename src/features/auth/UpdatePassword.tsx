import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'

/**
 * Set a new password after following a reset link. Supabase's recovery link
 * establishes a temporary session and fires a `PASSWORD_RECOVERY` auth event;
 * `SessionGate` shows this screen while that's active. `updateUser` sets the new
 * password on that session, after which the user is signed in normally. Buttons
 * + handlers only, no `<form>` (CLAUDE.md).
 */
export function UpdatePassword({ onDone }: { onDone: () => void }) {
  const { showToast } = useToast()
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const valid = password.length >= 8
  const canSubmit = valid && !submitting

  async function submit() {
    if (!canSubmit) return
    setSubmitting(true)
    const { error } = await supabase.auth.updateUser({ password })
    setSubmitting(false)
    if (error) {
      showToast({ title: "Couldn't update your password", description: error.message, variant: 'warn' })
      return
    }
    showToast({ title: 'Password updated', variant: 'success' })
    onDone()
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-paper-0 px-6">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-[40px] font-semibold leading-none text-coral-600">Moneta</h1>
        <p className="mt-3 text-[15px] text-ink-600">Choose a new password.</p>

        <div className="mt-8">
          <label htmlFor="new-password" className="block text-[12.5px] font-semibold uppercase tracking-wide text-ink-600">
            New password
          </label>
          <div className="relative mt-2">
            <input
              id="new-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submit()
              }}
              placeholder="At least 8 characters"
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

          <Button variant="primary" size="lg" fullWidth className="mt-5" disabled={!canSubmit} loading={submitting} onClick={submit}>
            Update password
          </Button>
        </div>
      </div>
    </main>
  )
}
