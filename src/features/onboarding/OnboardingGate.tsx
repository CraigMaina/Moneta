import type { ReactNode } from 'react'
import { useProfile } from '../transactions/queries'
import { OnboardingFlow } from './OnboardingFlow'
import { isOnboardingComplete } from './profileMutations'

/**
 * Sits just inside the session gate: a signed-in user who hasn't completed
 * onboarding (no `onboarding_completed` flag on their profile) gets the F1
 * flow; everyone else gets the app. While the profile resolves we show the
 * same calm splash as the session gate — never a spinner wall, never a flash
 * of the empty app before onboarding.
 */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const profileQuery = useProfile()

  if (profileQuery.isPending) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-paper-0">
        <h1 className="font-display text-[40px] font-semibold text-coral-600">Moneta</h1>
      </main>
    )
  }

  // On a profile-load error we don't trap the user in a splash — fall through to
  // the app (RLS still protects their data; they can retry from there).
  if (!profileQuery.isError && !isOnboardingComplete(profileQuery.data)) {
    return <OnboardingFlow />
  }

  return <>{children}</>
}
