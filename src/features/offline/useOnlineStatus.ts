import { onlineManager, useMutationState } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'

/**
 * Reactive online/offline via TanStack's `onlineManager` (the same source that
 * decides when to pause/resume mutations), read with `useSyncExternalStore` so
 * there's no effect + setState (PRD F12). Server-snapshot is `true` so SSR/first
 * paint assumes online.
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline(),
    () => true,
  )
}

/** How many mutations are currently paused (queued offline), for the sync indicator. */
export function usePendingSyncCount(): number {
  return useMutationState({ filters: { predicate: (mutation) => mutation.state.isPaused } }).length
}
