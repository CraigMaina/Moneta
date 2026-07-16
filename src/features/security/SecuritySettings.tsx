import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { useToast } from '../../components/ui/Toast'
import { cn } from '../../lib/cn'
import { useAuthUserId } from '../transactions/hooks/useAuthUserId'
import { enrollBiometric, isBiometricSupported } from './biometrics'
import { clearBiometricConfig, clearPinRecord, getBiometricConfig } from './lockStorage'
import { useLockStore } from './lockStore'
import { SetPinSheet } from './SetPinSheet'

/**
 * The "App lock" settings section (PRD F11): set/change a PIN, turn the lock
 * off, and — where the device supports it — enable biometric quick-unlock. Copy
 * is calm and factual; the lock is a local convenience over the real auth
 * boundary, so nothing here claims more security than it gives.
 */
export function SecuritySettings() {
  const { showToast } = useToast()
  const userId = useAuthUserId()
  const hasPin = useLockStore((state) => state.hasPin) ?? false
  const refresh = useLockStore((state) => state.refresh)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [bioSupported, setBioSupported] = useState(false)
  const [bioEnabled, setBioEnabled] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    void Promise.all([isBiometricSupported(), getBiometricConfig()]).then(([supported, config]) => {
      if (!active) return
      setBioSupported(supported)
      setBioEnabled(Boolean(config?.enabled))
    })
    return () => {
      active = false
    }
  }, [hasPin])

  const turnOff = async () => {
    setBusy(true)
    await clearPinRecord()
    await clearBiometricConfig()
    await refresh()
    setBioEnabled(false)
    setBusy(false)
    showToast({ title: 'App lock turned off', variant: 'success' })
  }

  const toggleBiometric = async () => {
    if (!userId) return
    setBusy(true)
    if (bioEnabled) {
      await clearBiometricConfig()
      setBioEnabled(false)
      showToast({ title: 'Biometric unlock off', variant: 'success' })
    } else {
      const ok = await enrollBiometric(userId)
      setBioEnabled(ok)
      showToast(
        ok
          ? { title: 'Biometric unlock on', variant: 'success' }
          : { title: "Couldn't set up biometrics", variant: 'warn' },
      )
    }
    setBusy(false)
  }

  return (
    <Card className="space-y-4">
      <div>
        <p className="text-[15px] font-semibold text-ink-900">App lock</p>
        <p className="mt-0.5 text-[12.5px] text-ink-600">
          {hasPin ? 'A 4-digit PIN is required to open Moneta on this device.' : 'Require a 4-digit PIN to open Moneta.'}
        </p>
      </div>

      {hasPin && bioSupported && (
        <button
          type="button"
          onClick={() => void toggleBiometric()}
          disabled={busy}
          role="switch"
          aria-checked={bioEnabled}
          className="flex w-full items-center justify-between gap-3 rounded-card bg-paper-0 px-4 py-3 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600"
        >
          <span className="text-[14px] font-semibold text-ink-900">Unlock with biometrics</span>
          {/* Knob is an in-flow flex child (not absolutely positioned) so its
              base position is unambiguous — items-center centres it vertically
              and translate-x slides it the track's width minus the knob. */}
          <span
            className={cn(
              'inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors',
              bioEnabled ? 'bg-coral-600' : 'bg-ink-300',
            )}
          >
            <span
              className={cn(
                'h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
                bioEnabled ? 'translate-x-[22px]' : 'translate-x-0.5',
              )}
            />
          </span>
        </button>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant={hasPin ? 'secondary' : 'primary'} onClick={() => setSheetOpen(true)} disabled={busy}>
          {hasPin ? 'Change PIN' : 'Set up app lock'}
        </Button>
        {hasPin && (
          <Button variant="ghost" onClick={() => void turnOff()} loading={busy}>
            Turn off
          </Button>
        )}
      </div>

      <SetPinSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </Card>
  )
}
