import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuthUserId } from '../transactions/hooks/useAuthUserId'
import { budgetKeys } from '../transactions/queryKeys'
import type { Budget } from './types'

/**
 * Budget CRUD (set/clear a category's monthly cap). Low-frequency management
 * actions, so a plain invalidate-on-success (not optimistic) is enough — the
 * server (RLS + `unique (user_id, category_id)`) is the authority. "Set" is an
 * upsert on that unique pair so a category always has at most one budget;
 * clearing a cap is a DELETE, never a zero (the check constraint forbids 0).
 */

export interface SetBudgetInput {
  categoryId: string
  /** Monthly cap in integer cents. Must be > 0. */
  amountCents: number
}

export function useSetBudget() {
  const queryClient = useQueryClient()
  const userId = useAuthUserId()
  return useMutation<Budget, Error, SetBudgetInput>({
    mutationFn: async ({ categoryId, amountCents }) => {
      if (!userId) throw new Error('useSetBudget: no authenticated user')
      if (!Number.isInteger(amountCents) || amountCents <= 0) {
        throw new Error('useSetBudget: amountCents must be a positive integer')
      }
      const { data, error } = await supabase
        .from('budgets')
        .upsert(
          { user_id: userId, category_id: categoryId, amount_cents: amountCents, updated_at: new Date().toISOString() },
          { onConflict: 'user_id,category_id' },
        )
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: budgetKeys.all(userId) }),
  })
}

export function useClearBudget() {
  const queryClient = useQueryClient()
  const userId = useAuthUserId()
  return useMutation<void, Error, string>({
    mutationFn: async (categoryId) => {
      if (!userId) throw new Error('useClearBudget: no authenticated user')
      const { error } = await supabase.from('budgets').delete().eq('category_id', categoryId)
      if (error) throw error
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: budgetKeys.all(userId) }),
  })
}
