import { useSearchParams } from 'react-router-dom'

/**
 * Landing route for the manual Add flow and the Web Share Target
 * (`share_target` in the manifest, PRD F3). This is a Phase 0 placeholder —
 * the real Add sheet (keypad, paste-parse) is built by the design/feature
 * engineers in a later phase.
 *
 * Note: the manifest declares a POST share target. Reading a POST body in
 * an SPA requires a service worker fetch handler that redirects the shared
 * payload into GET query params (`text`, `title`, `url`) before this route
 * ever renders — that interception is deferred to the phase that implements
 * F2/F3 parsing. This route already reads those params so it composes
 * cleanly with that future work.
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
