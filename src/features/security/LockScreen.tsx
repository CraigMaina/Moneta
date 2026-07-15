import { useEffect, useState } from 'react'
import { useSignOut } from '../settings/useSignOut'
import { verifyBiometric } from './biometrics'
import { getBiometricConfig, getPinRecord, type BiometricConfig } from './lockStorage'
import { useLockStore } from './lockStore'
import { PIN_LENGTH, PinPad } from './PinPad'
import type { PinRecord } from './pinCrypto'
import { verifyPin } from './pinCrypto'

/**
 * Full-screen lock (PRD F11). Shown by `LockGate` while a PIN is set and the
 * app is locked. Verifies the 4-digit PIN against the stored hash (constant
 * time), offers device-biometric unlock when enrolled, and a forgotten-PIN
 * escape that signs the user out and clears the local lock (re-auth with the
 * account is the real security boundary).
 */
export function LockScreen() {
  const unlock = useLockStore((state) => state.unlock)
  const refresh = useLockStore((state) => state.refresh)
  const { signOut } = useSignOut()

  const [record, setRecord] = useState<PinRecord | null>(null)
  const [biometric, setBiometric] = useState<BiometricConfig | null>(null)
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    let active = true
    void Promise.all([getPinRecord(), getBiometricConfig()]).then(([rec, bio]) => {
      if (!active) return
      setRecord(rec)
      setBiometric(bio?.enabled ? bio : null)
    })
    return () => {
      active = false
    }
  }, [])

  const handleComplete = async (pin: string) => {
    if (!record) return
    setChecking(true)
    const ok = await verifyPin(pin, record)
    setChecking(false)
    if (ok) {
      unlock()
      return
    }
    setError(true)
    setValue('')
    window.setTimeout(() => setError(false), 400)
  }

  const handleBiometric = async () => {
    if (!biometric) return
    const ok = await verifyBiometric(biometric.credentialId)
    if (ok) unlock()
  }

  const handleForgot = async () => {
    // Sign out AND clear the device lock — the user re-authenticates with their
    // account, which is the genuine access control; the PIN was a local gate.
    const { clearAllLockData } = await import('./lockStorage')
    await clearAllLockData()
    await refresh()
    await signOut()
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-paper-0 px-6 pb-[calc(env(safe-area-inset-bottom)+24px)]">
      <div className="flex flex-1 flex-col items-center justify-center gap-10">
        <div className="text-center">
          <h1 className="font-display text-[28px] font-semibold text-ink-900">Enter your PIN</h1>
          <p className="mt-1 text-[14px] text-ink-600">
            {error ? 'That PIN didn’t match. Try again.' : 'Moneta is locked.'}
          </p>
        </div>

        <PinPad
          value={value}
          onChange={setValue}
          onComplete={handleComplete}
          disabled={checking || !record}
          error={error}
        />

        {biometric && (
          <button
            type="button"
            onClick={handleBiometric}
            className="flex items-center gap-2 text-[15px] font-semibold text-coral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600 rounded-full px-3 py-1"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
              <path
                d="M12 11v3m-5-6a7 7 0 0 1 10 0M5 11a10 10 0 0 1 14 0M9 15a4 4 0 0 1 6 0"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
            Use biometrics
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => void handleForgot()}
        className="text-[13px] text-ink-600 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600 rounded px-2 py-1"
      >
        Forgot PIN? Sign out
      </button>
      <span className="sr-only" aria-live="polite">
        {value.length}/{PIN_LENGTH} digits entered
      </span>
    </main>
  )
}
