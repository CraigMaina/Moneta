import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { queryPersister } from '../../lib/queryClient'
import { useAuthUserId } from '../transactions/hooks/useAuthUserId'
import { clearAllLockData } from './lockStorage'

/**
 * "Delete all my data" (PRD F11). Removes the user's financial *records* — every
 * transaction, goal, contribution, recurring item, merchant rule, challenge, and
 * their streak — then resets the profile so onboarding runs fresh. It KEEPS the
 * account and category scaffolding (seeded at signup) so the app stays usable to
 * start over; the confirmation copy says exactly that, so nothing is misleading.
 *
 * True account deletion (removing the Supabase auth user) is a separate
 * server/admin operation and is out of scope here — noted in DECISIONS.md.
 *
 * RLS scopes every delete to the caller anyway; we also filter on `user_id`
 * explicitly. Children/leaves are deleted before parents to respect FKs.
 */
export function useDeleteAllData() {
  const queryClient = useQueryClient()
  const userId = useAuthUserId()

  return useMutation<void, Error, void>({
    mutationFn: async () => {
      if (!userId) throw new Error('useDeleteAllData: no authenticated user')

      // Order matters: goal_contributions references goals AND transactions;
      // delete it before either. The rest are independent.
      const del = async (result: { error: unknown }) => {
        if (result.error) throw result.error
      }
      await del(await supabase.from('goal_contributions').delete().eq('user_id', userId))
      await del(await supabase.from('transactions').delete().eq('user_id', userId))
      await del(await supabase.from('goals').delete().eq('user_id', userId))
      await del(await supabase.from('recurring_items').delete().eq('user_id', userId))
      await del(await supabase.from('merchant_rules').delete().eq('user_id', userId))
      await del(await supabase.from('challenges').delete().eq('user_id', userId))
      await del(await supabase.from('streaks').delete().eq('user_id', userId))

      // Reset the profile: zero the income baseline and clear consent flags so
      // the onboarding gate re-runs. Keep the row itself (the app expects one).
      await del(
        await supabase
          .from('profiles')
          .update({ expected_income_cents: 0, consent_flags: {}, pin_hash: null })
          .eq('user_id', userId),
      )
    },
    onSuccess: async () => {
      // Purge every trace of the old data from the client, including the device
      // lock, so nothing flashes from cache and the app truly starts fresh.
      queryClient.clear()
      await queryPersister.removeClient()
      await clearAllLockData()
    },
  })
}
