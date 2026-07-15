import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../lib/database.types'
import { useAuthUserId } from '../transactions/hooks/useAuthUserId'
import { profileKeys } from '../transactions/queryKeys'
import type { Profile } from '../transactions/types'

type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

/**
 * Profile updates. The `profiles` row always exists (the `handle_new_user`
 * trigger creates it at signup), so this is only ever an UPDATE, scoped by
 * `user_id` (RLS). Used by onboarding (income/cycle + the onboarding-complete
 * flag) and any future settings that touch the profile.
 */

export interface ProfilePatch {
  expected_income_cents?: number
  cycle_anchor_day?: number
  display_name?: string | null
  consent_flags?: Record<string, unknown>
  notification_prefs?: Record<string, unknown>
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()
  const userId = useAuthUserId()
  return useMutation<Profile, Error, ProfilePatch>({
    mutationFn: async (patch) => {
      if (!userId) throw new Error('useUpdateProfile: no authenticated user')
      // Our ProfilePatch jsonb fields are `Record<string, unknown>`; the generated
      // Update type wants `Json`. The shapes are value-compatible, so cast at the boundary.
      const { data, error } = await supabase
        .from('profiles')
        .update(patch as ProfileUpdate)
        .eq('user_id', userId)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: profileKeys.detail(userId) }),
  })
}

const ONBOARDING_FLAG = 'onboarding_completed'

/** Reads the onboarding-complete flag from a profile's `consent_flags` jsonb. */
export function isOnboardingComplete(profile: Profile | null | undefined): boolean {
  if (!profile) return false
  const flags = profile.consent_flags as Record<string, unknown> | null
  return Boolean(flags?.[ONBOARDING_FLAG])
}

/** Merge the onboarding-complete flag into existing consent flags (never clobbering other keys). */
export function withOnboardingComplete(profile: Profile | null | undefined): Record<string, unknown> {
  const flags = (profile?.consent_flags as Record<string, unknown> | null) ?? {}
  return { ...flags, [ONBOARDING_FLAG]: true }
}
