import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import { useSession } from './useSession'
import { SignIn } from './SignIn'
import { UpdatePassword } from './UpdatePassword'

/**
 * Gates the app on an auth session. While the session resolves, a calm splash
 * (never a spinner wall); signed out → the sign-in screen; signed in → the app.
 * RLS keys every row to `auth.uid()`, so this gate is also what makes the data
 * hooks (all `enabled` only once a user id resolves) actually load anything.
 *
 * A password-reset link lands here with a temporary session and a
 * `PASSWORD_RECOVERY` auth event; while that's active we show `UpdatePassword`
 * instead of the app (the recovery session IS a session, so it would otherwise
 * fall through to the authenticated branch).
 */
export function SessionGate({ children }: { children: ReactNode }) {
  const { status } = useSession()
  const [recovering, setRecovering] = useState(false)

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      else if (event === 'SIGNED_OUT') setRecovering(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (status === 'loading') {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-paper-0">
        <h1 className="font-display text-[40px] font-semibold text-coral-600">Moneta</h1>
      </main>
    )
  }

  if (recovering) {
    return <UpdatePassword onDone={() => setRecovering(false)} />
  }

  if (status === 'unauthenticated') {
    return <SignIn />
  }

  return <>{children}</>
}
