import { useState } from 'react'
import { Sheet } from '../../components/ui/Sheet'
import { useToast } from '../../components/ui/Toast'
import { useLockStore } from './lockStore'
import { setPinRecord } from './lockStorage'
import { hashPin } from './pinCrypto'
import { PinPad } from './PinPad'

/**
 * Set (or change) the 4-digit app-lock PIN (PRD F11). Two steps — choose, then
 * confirm — with a mismatch restarting cleanly. On success it hashes the PIN
 * (PBKDF2, never the raw value) into IndexedDB and refreshes the lock store.
 * Fresh mount per open resets the flow (no setState-in-effect).
 */
export function SetPinSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Set app lock">
      {open && <Body onClose={onClose} />}
    </Sheet>
  )
}

function Body({ onClose }: { onClose: () => void }) {
  const { showToast } = useToast()
  const refresh = useLockStore((state) => state.refresh)

  const [step, setStep] = useState<'choose' | 'confirm'>('choose')
  const [first, setFirst] = useState('')
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)
  const [saving, setSaving] = useState(false)

  const restart = () => {
    setError(true)
    setStep('choose')
    setFirst('')
    setValue('')
    window.setTimeout(() => setError(false), 500)
  }

  const handleComplete = async (pin: string) => {
    if (step === 'choose') {
      setFirst(pin)
      setValue('')
      setStep('confirm')
      return
    }
    if (pin !== first) {
      restart()
      return
    }
    setSaving(true)
    try {
      const record = await hashPin(pin)
      await setPinRecord(record)
      await refresh()
      showToast({ title: 'App lock is on', variant: 'success' })
      onClose()
    } catch {
      setSaving(false)
      showToast({ title: "Couldn't set the PIN", variant: 'warn' })
      restart()
    }
  }

  return (
    <div className="flex flex-col items-center gap-8 py-4">
      <div className="text-center">
        <p className="text-[16px] font-semibold text-ink-900">
          {step === 'choose' ? 'Choose a 4-digit PIN' : 'Enter it again'}
        </p>
        <p className="mt-1 text-[13px] text-ink-600">
          {error ? 'Those didn’t match. Start again.' : 'You’ll enter this to open Moneta.'}
        </p>
      </div>
      <PinPad value={value} onChange={setValue} onComplete={handleComplete} disabled={saving} error={error} />
    </div>
  )
}
