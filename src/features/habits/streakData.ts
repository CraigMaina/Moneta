import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../lib/database.types'
import { countDay, type StreakState } from '../../lib/streaks'
import { useAuthUserId } from '../transactions/hooks/useAuthUserId'
import { streakKeys } from '../transactions/queryKeys'

/**
 * Streak read + "count today" write (PRD F8). The `streaks` row is 1:1 with the
 * user but isn't seeded at signup, so reads tolerate its absence (a null row =
 * the zero state) and the write upserts. The new state is computed by the pure
 * `countDay` (freeze rules etc.) — this layer only does I/O.
 */

type StreakRow = Database['public']['Tables']['streaks']['Row']

export const ZERO_STREAK: StreakState = {
  currentCount: 0,
  longestCount: 0,
  lastCountedDate: null,
  freezesUsedThisWeek: 0,
}

function rowToState(row: StreakRow | null): StreakState {
  if (!row) return ZERO_STREAK
  return {
    currentCount: row.current_count,
    longestCount: row.longest_count,
    lastCountedDate: row.last_counted_date,
    freezesUsedThisWeek: row.freezes_used_this_week,
  }
}

export function useStreak() {
  const userId = useAuthUserId()
  return useQuery({
    queryKey: streakKeys.detail(userId),
    enabled: Boolean(userId),
    staleTime: 60 * 1000,
    queryFn: async (): Promise<StreakState> => {
      const { data, error } = await supabase.from('streaks').select('*').maybeSingle()
      if (error) throw error
      return rowToState(data)
    },
  })
}

/** Mark `today` (`yyyy-MM-dd`, Nairobi) as counted — extending, freezing, or resetting per `countDay`. */
export function useCountStreakDay() {
  const queryClient = useQueryClient()
  const userId = useAuthUserId()
  return useMutation<StreakState, Error, string>({
    mutationFn: async (today) => {
      if (!userId) throw new Error('useCountStreakDay: no authenticated user')
      const { data: existing, error: readError } = await supabase.from('streaks').select('*').maybeSingle()
      if (readError) throw readError

      const next = countDay(rowToState(existing), today)
      const { error: upsertError } = await supabase.from('streaks').upsert(
        {
          user_id: userId,
          current_count: next.currentCount,
          longest_count: next.longestCount,
          last_counted_date: next.lastCountedDate,
          freezes_used_this_week: next.freezesUsedThisWeek,
        },
        { onConflict: 'user_id' },
      )
      if (upsertError) throw upsertError
      return next
    },
    onSuccess: (next) => queryClient.setQueryData(streakKeys.detail(userId), next),
  })
}
