import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

/**
 * The current authenticated user's id, or `undefined` while the session is
 * still resolving / when signed out. There is no sign-in UI yet (out of
 * scope for Phase 2 — see CLAUDE.md brief), so every query/mutation hook in
 * this feature reads this and stays `enabled: false` until it resolves to a
 * real id; RLS keys every table to `auth.uid()`, so a live session is
 * required for any real read/write regardless of what this hook returns.
 */
export function useAuthUserId(): string | undefined {
  const [userId, setUserId] = useState<string | undefined>(undefined)

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (active) setUserId(data.session?.user.id)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  return userId
}
