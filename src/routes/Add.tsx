import { useSearchParams } from 'react-router-dom'

/**
 * Legacy `/add` placeholder. The real Add flow is the sheet on Home (keypad +
 * paste-parse), and the Web Share Target (PRD F3) is now a GET target whose
 * action is `/` — a shared SMS opens Home directly and launches paste-parse
 * (see `src/lib/shareTarget.ts` + `routes/Home.tsx`). This route no longer
 * participates in sharing; it just reads `?text` for backwards compatibility.
 */
export function Add() {
  const [searchParams] = useSearchParams()
  const sharedText = searchParams.get('text')

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-paper-0 px-6">
      <h1 className="font-display text-[22px] font-semibold text-ink-900">Add</h1>
      <p className="mt-2 max-w-sm text-center text-[15px] text-ink-600">
        {sharedText
          ? 'Shared text received. Parsing arrives in a later phase.'
          : 'The manual entry and paste-parse flows arrive in a later phase.'}
      </p>
    </main>
  )
}
