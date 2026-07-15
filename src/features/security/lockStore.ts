import { create } from 'zustand'
import { getPinRecord } from './lockStorage'

/**
 * App-lock UI state (PRD F11) — Zustand, exactly the "lock status" UI-only
 * state CLAUDE.md reserves for this store family. `hasPin === null` means we
 * haven't yet read IndexedDB; the gate shows a splash until then. `refresh()`
 * re-reads storage after the PIN is set/removed in Settings so the gate reacts
 * across the component tree.
 */
interface LockState {
  /** null = not yet loaded, then whether a PIN is configured on this device. */
  hasPin: boolean | null
  locked: boolean
  refresh: () => Promise<void>
  lock: () => void
  unlock: () => void
}

export const useLockStore = create<LockState>((set) => ({
  hasPin: null,
  locked: false,
  refresh: async () => {
    const record = await getPinRecord()
    const hasPin = Boolean(record)
    set((state) => ({
      hasPin,
      // Start locked the moment we first learn a PIN exists. After that, don't
      // relock here (the visibility handler owns auto-lock); if the PIN was just
      // removed, drop the lock so the user isn't stranded.
      locked: hasPin ? (state.hasPin === null ? true : state.locked) : false,
    }))
  },
  lock: () => set((state) => (state.hasPin ? { locked: true } : state)),
  unlock: () => set({ locked: false }),
}))
