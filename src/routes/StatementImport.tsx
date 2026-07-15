import { useNavigate } from 'react-router-dom'
import { ArrowRightIcon } from '../components/ui/icons'
import { StatementImportPanel } from '../features/import/StatementImportPanel'

/**
 * Statement import (PRD F5): paste an M-PESA full-statement's transaction table,
 * review the parsed rows (duplicates already-imported by `mpesa_ref` are flagged
 * and excluded), pick a target account, and import the new ones in one batch.
 * The parse/review/import logic is the shared `StatementImportPanel`, also used
 * by the onboarding backfill step. Parsing runs on-device; the
 * `import-statement` Edge Function is the deploy-ready server/PDF path.
 */
export function StatementImport() {
  const navigate = useNavigate()

  return (
    <main className="min-h-dvh bg-paper-0 pb-16">
      <div className="mx-auto max-w-md px-4 pt-[calc(env(safe-area-inset-top)+16px)]">
        <header className="flex items-center gap-2 py-2">
          <button
            type="button"
            onClick={() => navigate('/settings')}
            aria-label="Back to settings"
            className="flex h-11 w-11 items-center justify-center rounded-full text-ink-600 hover:bg-paper-50 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600"
          >
            <ArrowRightIcon className="h-5 w-5 rotate-180" />
          </button>
          <h1 className="font-display text-[22px] font-semibold text-ink-900">Import statement</h1>
        </header>

        <div className="mt-2">
          <StatementImportPanel onImported={() => navigate('/transactions')} />
        </div>
      </div>
    </main>
  )
}
