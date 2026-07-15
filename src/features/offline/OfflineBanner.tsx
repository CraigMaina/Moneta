import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { usePendingSyncCount, useOnlineStatus } from './useOnlineStatus'

/**
 * A slim top banner for connectivity (PRD F12). Offline → reassures the user
 * their changes are saved locally and will sync (calm, not alarming — Moneta
 * warns, it doesn't scold). Back online with queued writes → shows the sync in
 * progress. Silent when online and settled. Fixed at the top; overlays content
 * so it never reflows the screen.
 */
export function OfflineBanner() {
  const online = useOnlineStatus()
  const pending = usePendingSyncCount()
  const prefersReducedMotion = useReducedMotion()

  const message = !online
    ? 'You’re offline. Changes are saved here and will sync when you’re back.'
    : pending > 0
      ? `Syncing ${pending} change${pending === 1 ? '' : 's'}…`
      : null

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={prefersReducedMotion ? { opacity: 0 } : { y: -40, opacity: 0 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { y: 0, opacity: 1 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { y: -40, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          className="fixed inset-x-0 top-0 z-40 flex justify-center pt-[env(safe-area-inset-top)]"
        >
          <div
            className={`w-full px-4 py-2 text-center text-[12.5px] font-semibold ${
              online ? 'bg-leaf-600 text-white' : 'bg-ink-900 text-paper-0'
            }`}
          >
            {message}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
