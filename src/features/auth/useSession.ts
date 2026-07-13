import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated'

export interface UseSessionResult {
  session: Session | null
  status: SessionStatus
}

/**
 * The current auth session and a three-state status. Unlike `useAuthUserId`
 * (which returns `undefined` for both "still resolving" and "signed out"),
 * this distinguishes `loading` from `unauthenticated` so the session gate can
 * show a splash while resolving and the sign-in screen only when truly signed
 * out. Subscribes to `onAuthStateChange`, so a magic-link redirect or an OTP
 * verification flips the whole app to authenticated with no manual refresh.
 */
export function useSession(): UseSessionResult {
  const [session, setSession] = useState<Session | null>(null)
  const [status, setStatus] = useState<SessionStatus>('loading')

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setStatus(data.session ? 'authenticated' : 'unauthenticated')
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setStatus(nextSession ? 'authenticated' : 'unauthenticated')
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  return { session, status }
}
