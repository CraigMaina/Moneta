import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../../components/ui/Card'
import { cn } from '../../lib/cn'
import { formatKES } from '../../lib/money'
import { categoryIcon } from '../transactions/iconMaps'
import type { Category } from '../transactions/types'
import type { CategorySlice, Granularity } from '../insights/insightsMath'
import { budgetProgress } from './budgetMath'
import { useBudgets } from './queries'

/**
 * Budget-progress card on Insights (tracking half of the budgets feature; setup
 * lives in Settings → Budgets). Shows each budgeted category's spend against its
 * cap for the selected period, most-at-risk first. Empty state teaches the
 * action that fills it (CLAUDE.md). Money renders only through `formatKES`.
 */
export function BudgetsCard({
  byCategory,
  categoryById,
  granularity,
}: {
  byCategory: CategorySlice[]
  categoryById: Map<string, Category>
  granularity: Granularity
}) {
  const navigate = useNavigate()
  const budgetsQuery = useBudgets()
  const budgets = useMemo(() => budgetsQuery.data ?? [], [budgetsQuery.data])

  const rows = useMemo(() => budgetProgress(budgets, byCategory, granularity), [budgets, byCategory, granularity])

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-600">Budgets</h2>
        <button
          type="button"
          onClick={() => navigate('/budgets')}
          className="text-[13px] font-semibold text-coral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600"
        >
          {budgets.length > 0 ? 'Edit' : 'Set budgets'}
        </button>
      </div>

      {budgets.length === 0 ? (
        <p className="mt-2 text-[15px] text-ink-600">
          Set a cap for a category — say Food or Transport — and track it here each {granularity === 'week' ? 'week' : 'month'}.
        </p>
      ) : (
        <ul className="mt-3 space-y-3.5">
          {rows.map((row) => {
            const category = categoryById.get(row.categoryId)
            const pct = Math.round(row.ratio * 100)
            const barTone = row.over ? 'bg-coral-600' : row.nearing ? 'bg-amber-600' : 'bg-leaf-600'
            return (
              <li key={row.categoryId}>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center text-[15px]" aria-hidden="true">
                      {category ? categoryIcon(category) : '•'}
                    </span>
                    <span className="truncate text-[15px] font-semibold text-ink-900">{category?.name ?? 'Category'}</span>
                  </span>
                  <span
                    className={cn(
                      'flex-shrink-0 text-[13px] tabular-nums',
                      row.over ? 'font-semibold text-coral-600' : 'text-ink-600',
                    )}
                  >
                    {formatKES(row.spentCents)} / {formatKES(row.capCents)}
                  </span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-paper-50">
                  <div className={cn('h-full rounded-full', barTone)} style={{ width: `${Math.max(pct, row.spentCents > 0 ? 4 : 0)}%` }} />
                </div>
                <p className="mt-1 text-[12px] text-ink-600">
                  {row.over
                    ? `Over by ${formatKES(-row.remainingCents)}`
                    : `${formatKES(row.remainingCents)} left`}
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
