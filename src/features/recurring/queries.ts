import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuthUserId } from '../transactions/hooks/useAuthUserId'
import { recurringItemKeys } from '../transactions/queryKeys'
import type { RecurringItem } from '../transactions/types'

/**
 * All the user's recurring items (bills, subscriptions, standing income),
 * soonest-due first. The safe-to-spend calc has its own narrower
 * `useUpcomingRecurringBills` (expense-only, windowed) — this one is the full
 * list for the manage screen and the Home "due soon" surface.
 */
export function useRecurringItems() {
  const userId = useAuthUserId()
  return useQuery({
    queryKey: recurringItemKeys.all(userId),
    enabled: Boolean(userId),
    staleTime: 60 * 1000,
    queryFn: async (): Promise<RecurringItem[]> => {
      const { data, error } = await supabase
        .from('recurring_items')
        .select('*')
        .order('next_due_date', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })
}
