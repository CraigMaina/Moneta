import { WEEKS_PER_MONTH, type CategorySlice, type Granularity } from '../insights/insightsMath'
import type { Budget } from './types'

/**
 * Pure budget math (no I/O, integer cents in and out; `formatKES` happens only
 * at the display edge). Budgets are stored as MONTHLY caps; the weekly view
 * scales the cap by 12/52 so a month's cap and its four-ish weeks line up. The
 * spend side already excludes transfers (it comes from `insightsMath`, money
 * rule 3), so budgets can never be tripped by an internal transfer.
 */

/** The cap that applies to one period of the given grain, in integer cents. */
export function capForPeriod(monthlyCents: number, granularity: Granularity): number {
  if (granularity === 'week') return Math.round(monthlyCents / WEEKS_PER_MONTH)
  return monthlyCents
}

export interface BudgetProgress {
  categoryId: string
  /** Cap for the selected period (monthly cap, or its weekly slice). */
  capCents: number
  spentCents: number
  /** spent ÷ cap, clamped to [0, 1] for the bar; use `over` for the true state. */
  ratio: number
  remainingCents: number
  over: boolean
  /** At/над 80% but not yet over — the amber "nudge" zone. */
  nearing: boolean
}

/**
 * Join budgets to the period's per-category spend. One row per budgeted
 * category (categories without a budget are ignored; a budgeted category with
 * no spend shows 0). Sorted most-at-risk first (highest ratio, then largest
 * spend) so the tightest budgets lead.
 */
export function budgetProgress(
  budgets: Budget[],
  byCategory: CategorySlice[],
  granularity: Granularity,
): BudgetProgress[] {
  const spentByCategory = new Map<string, number>()
  for (const slice of byCategory) {
    if (slice.categoryId !== null) spentByCategory.set(slice.categoryId, slice.amountCents)
  }

  return budgets
    .map((budget): BudgetProgress => {
      const capCents = capForPeriod(budget.amount_cents, granularity)
      const spentCents = spentByCategory.get(budget.category_id) ?? 0
      const ratio = capCents > 0 ? Math.min(spentCents / capCents, 1) : 0
      const over = capCents > 0 && spentCents > capCents
      return {
        categoryId: budget.category_id,
        capCents,
        spentCents,
        ratio,
        remainingCents: capCents - spentCents,
        over,
        nearing: !over && capCents > 0 && spentCents / capCents >= 0.8,
      }
    })
    .sort(
      (a, b) =>
        b.spentCents / Math.max(b.capCents, 1) - a.spentCents / Math.max(a.capCents, 1) ||
        b.spentCents - a.spentCents,
    )
}
