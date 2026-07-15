import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuthUserId } from '../transactions/hooks/useAuthUserId'
import { accountBalanceKeys, recurringItemKeys, transactionKeys } from '../transactions/queryKeys'
import { addTransactionSchema } from '../transactions/schemas'
import type { RecurringItem } from '../transactions/types'
import { advanceDueDate } from './cadence'
import { createRecurringSchema, updateRecurringSchema, type CreateRecurringInput, type UpdateRecurringInput } from './schemas'

/**
 * Recurring-item mutations (PRD F6). Create/update/delete are plain
 * invalidate-on-success. `markPaid` is the one that touches money: it books a
 * real transaction from the template (so it flows through balances and
 * safe-to-spend exactly like a manual entry) AND advances `next_due_date` by
 * one cadence step. `user_id` is always injected from the session.
 */

function invalidateRecurring(queryClient: ReturnType<typeof useQueryClient>, userId: string | undefined): void {
  void queryClient.invalidateQueries({ queryKey: recurringItemKeys.all(userId) })
}

export function useCreateRecurringItem() {
  const queryClient = useQueryClient()
  const userId = useAuthUserId()
  return useMutation<RecurringItem, Error, CreateRecurringInput>({
    mutationFn: async (input) => {
      if (!userId) throw new Error('useCreateRecurringItem: no authenticated user')
      const parsed = createRecurringSchema.parse(input)
      const { data, error } = await supabase
        .from('recurring_items')
        .insert({ ...parsed, user_id: userId })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => invalidateRecurring(queryClient, userId),
  })
}

export function useUpdateRecurringItem() {
  const queryClient = useQueryClient()
  const userId = useAuthUserId()
  return useMutation<RecurringItem, Error, { id: string; patch: UpdateRecurringInput }>({
    mutationFn: async ({ id, patch }) => {
      if (!userId) throw new Error('useUpdateRecurringItem: no authenticated user')
      const parsed = updateRecurringSchema.parse(patch)
      const { data, error } = await supabase.from('recurring_items').update(parsed).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => invalidateRecurring(queryClient, userId),
  })
}

export function useDeleteRecurringItem() {
  const queryClient = useQueryClient()
  const userId = useAuthUserId()
  return useMutation<{ id: string }, Error, string>({
    mutationFn: async (id) => {
      if (!userId) throw new Error('useDeleteRecurringItem: no authenticated user')
      const { error } = await supabase.from('recurring_items').delete().eq('id', id)
      if (error) throw error
      return { id }
    },
    onSuccess: () => invalidateRecurring(queryClient, userId),
  })
}

/**
 * "Mark paid" (PRD F6): book the template as a real transaction dated now, then
 * roll the due date forward one cadence step. Not optimistic — it's a
 * deliberate confirm tap, and correctness (a real ledger row + advanced date)
 * matters more than instant feedback here.
 */
export function useMarkRecurringPaid() {
  const queryClient = useQueryClient()
  const userId = useAuthUserId()
  return useMutation<{ id: string }, Error, RecurringItem>({
    mutationFn: async (item) => {
      if (!userId) throw new Error('useMarkRecurringPaid: no authenticated user')

      const transaction = addTransactionSchema.parse({
        kind: item.kind,
        amount_cents: item.amount_cents,
        account_id: item.account_id,
        category_id: item.kind === 'transfer' ? null : item.category_id,
        merchant: item.merchant,
        note: item.note,
        source: 'manual',
      })
      const { error: txnError } = await supabase.from('transactions').insert({ ...transaction, user_id: userId })
      if (txnError) throw txnError

      const { error: advanceError } = await supabase
        .from('recurring_items')
        .update({ next_due_date: advanceDueDate(item.next_due_date, item.cadence) })
        .eq('id', item.id)
      if (advanceError) throw advanceError

      return { id: item.id }
    },
    onSuccess: () => {
      invalidateRecurring(queryClient, userId)
      void queryClient.invalidateQueries({ queryKey: transactionKeys.all(userId) })
      void queryClient.invalidateQueries({ queryKey: accountBalanceKeys.all(userId) })
    },
  })
}
