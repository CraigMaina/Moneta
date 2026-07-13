/**
 * Placeholder Insights route — exists so `TabBar` has a real route to
 * navigate to (Phase 1 design-system brief). The real insights/charts
 * feature is a later feature-folder phase.
 */
export function Insights() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-paper-0 px-6">
      <h1 className="font-display text-[22px] font-semibold text-ink-900">Insights</h1>
      <p className="mt-2 max-w-sm text-center text-[15px] text-ink-600">
        Spending insights arrive in a later phase.
      </p>
    </main>
  )
}
