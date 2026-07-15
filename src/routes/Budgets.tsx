import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { ArrowRightIcon, ChevronRightIcon, InsightsIcon } from '../components/ui/icons'
import { BudgetEditorSheet } from '../features/budgets/BudgetEditorSheet'
import { useBudgets } from '../features/budgets/queries'
import { categoryIcon } from '../features/transactions/iconMaps'
import { useCategories } from '../features/transactions/queries'
import type { Category } from '../features/transactions/types'
import { formatKES } from '../lib/money'

/**
 * Budgets (setup half of the feature; tracking lives on Insights). Set a monthly
 * cap per spending category. Reached from Settings → Money (not a bottom tab).
 * Amounts are integer cents throughout; a cap is a monthly figure and the weekly
 * view is derived on Insights.
 */
export function Budgets() {
  const navigate = useNavigate()
  const categoriesQuery = useCategories()
  const budgetsQuery = useBudgets()

  const [editing, setEditing] = useState<Category | null>(null)

  const spendingCategories = useMemo(
    () => (categoriesQuery.data ?? []).filter((c) => c.kind === 'expense'),
    [categoriesQuery.data],
  )
  const capByCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const b of budgetsQuery.data ?? []) map.set(b.category_id, b.amount_cents)
    return map
  }, [budgetsQuery.data])

  const isPending = categoriesQuery.isPending || budgetsQuery.isPending
  const isError = categoriesQuery.isError || budgetsQuery.isError

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
          <h1 className="font-display text-[22px] font-semibold text-ink-900">Budgets</h1>
        </header>

        <p className="mt-1 text-[13px] leading-snug text-ink-600">
          Set a monthly cap per category. Track your progress on Insights — switch to the weekly view there to see
          the weekly slice of each cap.
        </p>

        <div className="mt-4">
          {isPending ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-card bg-paper-50 motion-reduce:animate-none" aria-hidden="true" />
              ))}
            </div>
          ) : isError ? (
            <Card className="flex items-center justify-between gap-3">
              <p className="text-[15px] text-ink-600">Couldn&apos;t load your budgets.</p>
              <Button
                variant="secondary"
                onClick={() => {
                  void categoriesQuery.refetch()
                  void budgetsQuery.refetch()
                }}
              >
                Retry
              </Button>
            </Card>
          ) : spendingCategories.length === 0 ? (
            <Card className="p-0">
              <EmptyState
                icon={<InsightsIcon />}
                title="No spending categories yet"
                description="Add a spending category in Settings first, then set a budget for it here."
                actionLabel="Go to Settings"
                onAction={() => navigate('/settings')}
              />
            </Card>
          ) : (
            <Card className="divide-y divide-ink-300/40 p-0">
              {spendingCategories.map((category) => {
                const cap = capByCategory.get(category.id) ?? null
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setEditing(category)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600"
                  >
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-paper-50 text-ink-900">
                      {categoryIcon(category)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink-900">{category.name}</span>
                    {cap !== null ? (
                      <span className="flex-shrink-0 text-[15px] tabular-nums text-ink-900">{formatKES(cap)}<span className="text-ink-600">/mo</span></span>
                    ) : (
                      <span className="flex-shrink-0 text-[15px] text-ink-600">Set budget</span>
                    )}
                    <ChevronRightIcon className="h-5 w-5 flex-shrink-0 text-ink-600" />
                  </button>
                )
              })}
            </Card>
          )}
        </div>
      </div>

      <BudgetEditorSheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        category={editing}
        currentCapCents={editing ? (capByCategory.get(editing.id) ?? null) : null}
      />
    </main>
  )
}
