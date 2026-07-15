import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuthUserId } from '../transactions/hooks/useAuthUserId'
import { goalContributionKeys, goalKeys } from '../transactions/queryKeys'
import { createGoalSchema, updateGoalSchema, type CreateGoalInput, type UpdateGoalInput } from './schemas'
import type { Goal } from './types'

/**
 * Savings-goal mutations (PRD F7). Goals are low-frequency, so these are
 * plain invalidate-on-success rather than the optimistic money-path pattern.
 * `user_id` is always injected from the session (RLS is the authority).
 * Contributing books a `goal_contributions` row (a tracked earmark, not a
 * transaction — see DECISIONS.md) and, the moment the derived total reaches
 * the target, stamps `achieved_at` exactly once so the celebration fires once.
 */

function invalidateGoals(queryClient: ReturnType<typeof useQueryClient>, userId: string | undefined): void {
  void queryClient.invalidateQueries({ queryKey: goalKeys.all(userId) })
  void queryClient.invalidateQueries({ queryKey: goalContributionKeys.all(userId) })
}

export function useCreateGoal() {
  const queryClient = useQueryClient()
  const userId = useAuthUserId()
  return useMutation<Goal, Error, CreateGoalInput>({
    mutationFn: async (input) => {
      if (!userId) throw new Error('useCreateGoal: no authenticated user')
      const parsed = createGoalSchema.parse(input)
      const { data, error } = await supabase
        .from('goals')
        .insert({ ...parsed, emoji: parsed.emoji ?? null, target_date: parsed.target_date ?? null, user_id: userId })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => invalidateGoals(queryClient, userId),
  })
}

export function useUpdateGoal() {
  const queryClient = useQueryClient()
  const userId = useAuthUserId()
  return useMutation<Goal, Error, { id: string; patch: UpdateGoalInput }>({
    mutationFn: async ({ id, patch }) => {
      if (!userId) throw new Error('useUpdateGoal: no authenticated user')
      const parsed = updateGoalSchema.parse(patch)
      const { data, error } = await supabase.from('goals').update(parsed).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => invalidateGoals(queryClient, userId),
  })
}

export function useDeleteGoal() {
  const queryClient = useQueryClient()
  const userId = useAuthUserId()
  return useMutation<{ id: string }, Error, string>({
    mutationFn: async (id) => {
      if (!userId) throw new Error('useDeleteGoal: no authenticated user')
      // goal_contributions cascade on delete (FK on delete cascade).
      const { error } = await supabase.from('goals').delete().eq('id', id)
      if (error) throw error
      return { id }
    },
    onSuccess: () => invalidateGoals(queryClient, userId),
  })
}

export interface ContributeArgs {
  goalId: string
  amountCents: number
  targetCents: number
  /** The goal's current `achieved_at` — so we only stamp it (and celebrate) once. */
  alreadyAchieved: boolean
}

export interface ContributeResult {
  /** True only on the contribution that crossed the target for the first time. */
  justReached: boolean
}

export function useContributeToGoal() {
  const queryClient = useQueryClient()
  const userId = useAuthUserId()
  return useMutation<ContributeResult, Error, ContributeArgs>({
    mutationFn: async ({ goalId, amountCents, targetCents, alreadyAchieved }) => {
      if (!userId) throw new Error('useContributeToGoal: no authenticated user')
      if (!Number.isInteger(amountCents) || amountCents <= 0) throw new Error('contribution must be positive whole cents')

      const { error: insertError } = await supabase.from('goal_contributions').insert({
        goal_id: goalId,
        user_id: userId,
        amount_cents: amountCents,
        transaction_id: null,
      })
      if (insertError) throw insertError

      // Re-derive the saved total from the source of truth (never a stored
      // running total) to decide if this contribution reached the target.
      const { data: rows, error: sumError } = await supabase
        .from('goal_contributions')
        .select('amount_cents')
        .eq('goal_id', goalId)
      if (sumError) throw sumError
      const savedCents = (rows ?? []).reduce((sum, r) => sum + r.amount_cents, 0)

      let justReached = false
      if (!alreadyAchieved && savedCents >= targetCents) {
        const { error: achieveError } = await supabase
          .from('goals')
          .update({ achieved_at: new Date().toISOString() })
          .eq('id', goalId)
        if (achieveError) throw achieveError
        justReached = true
      }

      return { justReached }
    },
    onSuccess: () => invalidateGoals(queryClient, userId),
  })
}
