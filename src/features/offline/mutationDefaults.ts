import type { QueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import {
  performAddTransaction,
  performSaveParsedTransactions,
  type SaveParsedResult,
} from '../transactions/mutations'
import { accountBalanceKeys, mutationKeys, transactionKeys } from '../transactions/queryKeys'
import type { AddTransactionInput } from '../transactions/schemas'

/**
 * Cross-reload offline resume (PRD F12). When the app is offline, TanStack
 * pauses these mutations (their optimistic cache change is applied and persisted
 * to IndexedDB). If the user closes the PWA before reconnecting, the paused
 * mutation is rehydrated on next launch — but its original closure is gone, so
 * TanStack needs a `mutationFn` from `setMutationDefaults`, keyed by the same
 * `mutationKey` the hook used. These defaults supply exactly that (reading the
 * live session for the user id) plus the settle-time invalidation, so a
 * transaction logged in a tunnel is written the moment signal returns.
 *
 * Only the transaction-creating writes are made reload-durable — they're the
 * ones that matter for "log it now, sync later". Other mutations still queue and
 * resume within a session; they just aren't replayed after a full reload.
 */
async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const userId = data.session?.user?.id
  if (!userId) throw new Error('offline resume: no authenticated user')
  return userId
}

function invalidateAfterResume(queryClient: QueryClient): void {
  void currentUserId().then((userId) => {
    void queryClient.invalidateQueries({ queryKey: transactionKeys.all(userId) })
    void queryClient.invalidateQueries({ queryKey: accountBalanceKeys.all(userId) })
  })
}

export function registerMutationDefaults(queryClient: QueryClient): void {
  queryClient.setMutationDefaults(mutationKeys.addTransaction, {
    mutationFn: async (input) => {
      const userId = await currentUserId()
      return performAddTransaction(userId, input as unknown as AddTransactionInput)
    },
    onSettled: () => invalidateAfterResume(queryClient),
  })

  queryClient.setMutationDefaults(mutationKeys.saveParsedTransactions, {
    mutationFn: async (input): Promise<SaveParsedResult> => {
      const userId = await currentUserId()
      return performSaveParsedTransactions(userId, input as unknown as AddTransactionInput[])
    },
    onSettled: () => invalidateAfterResume(queryClient),
  })
}
