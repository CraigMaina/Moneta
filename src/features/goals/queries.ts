import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuthUserId } from '../transactions/hooks/useAuthUserId'
import { goalContributionKeys, goalKeys } from '../transactions/queryKeys'
import type { Goal, GoalContribution } from './types'

/**
 * Read hooks for savings goals (PRD F7). A goal's saved amount is derived from
 * its contributions (see `goalMath`), so we fetch the two separately and the
 * UI joins them — never a stored running total. RLS scopes every row to the
 * user; both queries stay disabled until a user id resolves.
 */

const STALE_TIME_MS = 60 * 1000

export function useGoals() {
  const userId = useAuthUserId()
  return useQuery({
    queryKey: goalKeys.all(userId),
    enabled: Boolean(userId),
    staleTime: STALE_TIME_MS,
    queryFn: async (): Promise<Goal[]> => {
      const { data, error } = await supabase.from('goals').select('*').order('created_at', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })
}

/** All of the user's contributions across every goal; the UI groups by `goal_id`. */
export function useGoalContributions() {
  const userId = useAuthUserId()
  return useQuery({
    queryKey: goalContributionKeys.all(userId),
    enabled: Boolean(userId),
    staleTime: STALE_TIME_MS,
    queryFn: async (): Promise<GoalContribution[]> => {
      const { data, error } = await supabase
        .from('goal_contributions')
        .select('*')
        .order('occurred_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}
