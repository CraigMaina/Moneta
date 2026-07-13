import { QueryClient } from '@tanstack/react-query'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { get, set, del } from 'idb-keyval'

/**
 * TanStack Query cache, persisted to IndexedDB (via idb-keyval) rather than
 * localStorage — CLAUDE.md forbids localStorage for financial data.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 24 * 60 * 60 * 1000,
      retry: 1,
    },
  },
})

// idb-keyval's get/set/del map directly onto the getItem/setItem/removeItem
// shape the async storage persister expects.
const idbStorage = {
  getItem: async (key: string): Promise<string | null> => {
    const value = await get<string>(key)
    return value ?? null
  },
  setItem: async (key: string, value: string): Promise<void> => {
    await set(key, value)
  },
  removeItem: async (key: string): Promise<void> => {
    await del(key)
  },
}

export const queryPersister = createAsyncStoragePersister({
  storage: idbStorage,
  key: 'moneta-query-cache',
})
