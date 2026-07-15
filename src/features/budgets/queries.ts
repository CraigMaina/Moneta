import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuthUserId } from '../transactions/hooks/useAuthUserId'
import { budgetKeys } from '../transactions/queryKeys'
import type { Budget } from './types'

/**
 * Read hook for per-category budgets. Each row is a MONTHLY cap; the weekly view
 * is derived in `budgetMath` (never stored). RLS scopes rows to the user; the
 * query stays disabled until a user id resolves.
 */

const STALE_TIME_MS = 60 * 1000

export function useBudgets() {
  const userId = useAuthUserId()
  return useQuery({
    queryKey: budgetKeys.all(userId),
    enabled: Boolean(userId),
    staleTime: STALE_TIME_MS,
    queryFn: async (): Promise<Budget[]> => {
      const { data, error } = await supabase.from('budgets').select('*')
      if (error) throw error
      return data ?? []
    },
  })
}
