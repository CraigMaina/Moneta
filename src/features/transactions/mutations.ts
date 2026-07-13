import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { applyBalanceDeltas, negateDeltas, transactionBalanceDeltas } from './balanceDelta'
import { useAuthUserId } from './hooks/useAuthUserId'
import { accountBalanceKeys, transactionKeys } from './queryKeys'
import { addTransactionSchema, updateTransactionSchema, type AddTransactionInput, type UpdateTransactionInput } from './schemas'
import type { AccountBalance, Transaction } from './types'

/**
 * Typed mutation hooks for `transactions` — optimistic with rollback per
 * CLAUDE.md ("Mutations are optimistic with rollback"). Each follows the
 * standard TanStack `onMutate`/`onError`/`onSettled` shape: cancel in-flight
 * queries, snapshot the cache, apply the optimistic change (to both the
 * transaction list AND `account_balances`), roll back on error, and
 * invalidate on settle so the server's numbers are the last word.
 *
 * An offline write still runs this same optimistic path — TanStack Query's
 * mutation stays pending/erroring until the network returns, at which point
 * a caller-side retry (or the app's mutation-queue replay, once built) calls
 * `mutate` again; nothing here assumes a network round-trip completes
 * synchronously.
 */

function optimisticId(): string {
  return `optimistic-${crypto.randomUUID()}`
}

/** True for a not-yet-persisted optimistic row's `id` — lets a consumer show a pending affordance. */
export function isOptimisticId(id: string): boolean {
  return id.startsWith('optimistic-')
}

function sortByOccurredAtDesc(rows: Transaction[]): Transaction[] {
  return [...rows].sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
}

interface TransactionListSnapshot {
  key: readonly unknown[]
  data: Transaction[] | undefined
}

function snapshotTransactionLists(queryClient: QueryClient, userId: string | undefined): TransactionListSnapshot[] {
  return queryClient
    .getQueriesData<Transaction[]>({ queryKey: transactionKeys.all(userId) })
    .map(([key, data]) => ({ key, data }))
}

function restoreTransactionLists(queryClient: QueryClient, snapshots: TransactionListSnapshot[]): void {
  for (const { key, data } of snapshots) {
    queryClient.setQueryData(key, data)
  }
}

function findCached(snapshots: TransactionListSnapshot[], id: string): Transaction | undefined {
  for (const { data } of snapshots) {
    const match = data?.find((t) => t.id === id)
    if (match) return match
  }
  return undefined
}

async function cancelTransactionAndBalanceQueries(queryClient: QueryClient, userId: string | undefined): Promise<void> {
  await queryClient.cancelQueries({ queryKey: transactionKeys.all(userId) })
  await queryClient.cancelQueries({ queryKey: accountBalanceKeys.all(userId) })
}

function invalidateTransactionAndBalanceQueries(queryClient: QueryClient, userId: string | undefined): void {
  void queryClient.invalidateQueries({ queryKey: transactionKeys.all(userId) })
  void queryClient.invalidateQueries({ queryKey: accountBalanceKeys.all(userId) })
}

interface MutationContext {
  snapshots: TransactionListSnapshot[]
  previousBalances: AccountBalance[] | undefined
}

function rollback(queryClient: QueryClient, userId: string | undefined, context: MutationContext | undefined): void {
  if (!context) return
  restoreTransactionLists(queryClient, context.snapshots)
  if (context.previousBalances !== undefined) {
    queryClient.setQueryData(accountBalanceKeys.all(userId), context.previousBalances)
  }
}

export function useAddTransaction() {
  const queryClient = useQueryClient()
  const userId = useAuthUserId()

  return useMutation<Transaction, Error, AddTransactionInput, MutationContext>({
    mutationFn: async (input) => {
      if (!userId) throw new Error('useAddTransaction: no authenticated user')
      const parsed = addTransactionSchema.parse(input)
      const { data, error } = await supabase
        .from('transactions')
        .insert({ ...parsed, user_id: userId })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onMutate: async (input) => {
      const parsed = addTransactionSchema.parse(input)
      await cancelTransactionAndBalanceQueries(queryClient, userId)

      const snapshots = snapshotTransactionLists(queryClient, userId)
      const previousBalances = queryClient.getQueryData<AccountBalance[]>(accountBalanceKeys.all(userId))

      const optimisticRow: Transaction = {
        id: optimisticId(),
        user_id: userId ?? '',
        created_at: new Date().toISOString(),
        occurred_at: parsed.occurred_at ?? new Date().toISOString(),
        source: parsed.source ?? 'manual',
        account_id: parsed.account_id,
        counter_account_id: parsed.counter_account_id ?? null,
        category_id: parsed.category_id ?? null,
        amount_cents: parsed.amount_cents,
        kind: parsed.kind,
        merchant: parsed.merchant ?? null,
        note: parsed.note ?? null,
        mpesa_ref: parsed.mpesa_ref ?? null,
        fee_cents: parsed.fee_cents ?? null,
        parser_version: parsed.parser_version ?? null,
        raw_sms: parsed.raw_sms ?? null,
      }

      for (const { key, data } of snapshots) {
        queryClient.setQueryData<Transaction[]>(key, sortByOccurredAtDesc([optimisticRow, ...(data ?? [])]))
      }

      let balances = previousBalances
      if (balances) {
        balances = applyBalanceDeltas(balances, transactionBalanceDeltas(optimisticRow))
        queryClient.setQueryData<AccountBalance[]>(accountBalanceKeys.all(userId), balances)
      }

      return { snapshots, previousBalances }
    },
    onError: (_err, _input, context) => rollback(queryClient, userId, context),
    onSettled: () => invalidateTransactionAndBalanceQueries(queryClient, userId),
  })
}

export interface UpdateTransactionArgs {
  id: string
  patch: UpdateTransactionInput
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient()
  const userId = useAuthUserId()

  return useMutation<Transaction, Error, UpdateTransactionArgs, MutationContext>({
    mutationFn: async ({ id, patch }) => {
      if (!userId) throw new Error('useUpdateTransaction: no authenticated user')
      const parsed = updateTransactionSchema.parse(patch)
      const { data, error } = await supabase.from('transactions').update(parsed).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onMutate: async ({ id, patch }) => {
      const parsed = updateTransactionSchema.parse(patch)
      await cancelTransactionAndBalanceQueries(queryClient, userId)

      const snapshots = snapshotTransactionLists(queryClient, userId)
      const previousBalances = queryClient.getQueryData<AccountBalance[]>(accountBalanceKeys.all(userId))
      const existing = findCached(snapshots, id)

      let balances = previousBalances
      if (existing) {
        const updated: Transaction = { ...existing, ...parsed }

        for (const { key, data } of snapshots) {
          if (!data) continue
          queryClient.setQueryData<Transaction[]>(
            key,
            sortByOccurredAtDesc(data.map((t) => (t.id === id ? updated : t))),
          )
        }

        if (balances) {
          const reverse = negateDeltas(transactionBalanceDeltas(existing))
          const forward = transactionBalanceDeltas(updated)
          balances = applyBalanceDeltas(applyBalanceDeltas(balances, reverse), forward)
          queryClient.setQueryData<AccountBalance[]>(accountBalanceKeys.all(userId), balances)
        }
      }

      return { snapshots, previousBalances }
    },
    onError: (_err, _vars, context) => rollback(queryClient, userId, context),
    onSettled: () => invalidateTransactionAndBalanceQueries(queryClient, userId),
  })
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient()
  const userId = useAuthUserId()

  return useMutation<{ id: string }, Error, string, MutationContext>({
    mutationFn: async (id) => {
      if (!userId) throw new Error('useDeleteTransaction: no authenticated user')
      const { error } = await supabase.from('transactions').delete().eq('id', id)
      if (error) throw error
      return { id }
    },
    onMutate: async (id) => {
      await cancelTransactionAndBalanceQueries(queryClient, userId)

      const snapshots = snapshotTransactionLists(queryClient, userId)
      const previousBalances = queryClient.getQueryData<AccountBalance[]>(accountBalanceKeys.all(userId))
      const existing = findCached(snapshots, id)

      for (const { key, data } of snapshots) {
        if (!data) continue
        queryClient.setQueryData<Transaction[]>(
          key,
          data.filter((t) => t.id !== id),
        )
      }

      if (existing && previousBalances) {
        const reverse = negateDeltas(transactionBalanceDeltas(existing))
        queryClient.setQueryData<AccountBalance[]>(accountBalanceKeys.all(userId), applyBalanceDeltas(previousBalances, reverse))
      }

      return { snapshots, previousBalances }
    },
    onError: (_err, _id, context) => rollback(queryClient, userId, context),
    onSettled: () => invalidateTransactionAndBalanceQueries(queryClient, userId),
  })
}
