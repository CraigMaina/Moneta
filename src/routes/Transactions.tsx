/**
 * Placeholder Transactions route — exists so `TabBar` has a real route to
 * navigate to (Phase 1 design-system brief). The real transactions list
 * (with its loading/empty/error states) is a later feature-folder phase.
 */
export function Transactions() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-paper-0 px-6">
      <h1 className="font-display text-[22px] font-semibold text-ink-900">Transactions</h1>
      <p className="mt-2 max-w-sm text-center text-[15px] text-ink-600">
        Your transaction list arrives in a later phase.
      </p>
    </main>
  )
}
