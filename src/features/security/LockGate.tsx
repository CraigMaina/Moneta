import { useEffect, type ReactNode } from 'react'
import { LockScreen } from './LockScreen'
import { useLockStore } from './lockStore'

/**
 * Gates the app on the local PIN lock (PRD F11). Transparent when no PIN is
 * configured. On first load it reads the lock config (splash until known);
 * while locked it shows the `LockScreen`. Auto-locks whenever the app is
 * backgrounded, so returning to a foregrounded PWA always requires unlock.
 */
export function LockGate({ children }: { children: ReactNode }) {
  const hasPin = useLockStore((state) => state.hasPin)
  const locked = useLockStore((state) => state.locked)
  const refresh = useLockStore((state) => state.refresh)
  const lock = useLockStore((state) => state.lock)

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') lock()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [lock])

  // Not yet read from storage — same calm splash the other gates use.
  if (hasPin === null) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-paper-0">
        <h1 className="font-display text-[40px] font-semibold text-coral-600">Moneta</h1>
      </main>
    )
  }

  if (hasPin && locked) return <LockScreen />

  return <>{children}</>
}
