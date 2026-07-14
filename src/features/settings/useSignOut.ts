import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { queryPersister } from '../../lib/queryClient'

/**
 * Sign the user out and leave nothing behind. Beyond `supabase.auth.signOut()`
 * (which flips the app to the sign-in screen via `onAuthStateChange`), this
 * clears the in-memory query cache AND the persisted IndexedDB copy — so the
 * next person to open this PWA install never sees the previous user's balances
 * or transactions flash from cache before RLS re-scopes the data.
 */
export function useSignOut() {
  const queryClient = useQueryClient()
  const [signingOut, setSigningOut] = useState(false)

  const signOut = async () => {
    setSigningOut(true)
    try {
      await supabase.auth.signOut()
      queryClient.clear()
      await queryPersister.removeClient()
    } finally {
      setSigningOut(false)
    }
  }

  return { signOut, signingOut }
}
