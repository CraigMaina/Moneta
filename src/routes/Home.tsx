/**
 * Placeholder Home route for the Phase 0 shell. The real Home screen (the
 * safe-to-spend hero, coral arc, quiet supporting content) is built by the
 * design-engineer / feature-engineer in a later phase — see moneta-prd.md.
 */
export function Home() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-paper-0 px-6">
      <h1 className="font-display text-[44px] font-semibold tracking-tight text-ink-900">Moneta</h1>
      <p className="mt-2 text-[15px] text-ink-600">Know what you can spend today.</p>
    </main>
  )
}
