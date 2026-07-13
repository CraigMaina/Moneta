import type { ReactNode } from 'react'
import { useSession } from './useSession'
import { SignIn } from './SignIn'

/**
 * Gates the app on an auth session. While the session resolves, a calm splash
 * (never a spinner wall); signed out → the sign-in screen; signed in → the app.
 * RLS keys every row to `auth.uid()`, so this gate is also what makes the data
 * hooks (all `enabled` only once a user id resolves) actually load anything.
 */
export function SessionGate({ children }: { children: ReactNode }) {
  const { status } = useSession()

  if (status === 'loading') {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-paper-0">
        <h1 className="font-display text-[40px] font-semibold text-coral-600">Moneta</h1>
      </main>
    )
  }

  if (status === 'unauthenticated') {
    return <SignIn />
  }

  return <>{children}</>
}
