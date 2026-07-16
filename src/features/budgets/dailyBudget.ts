import { TZDate } from '@date-fns/tz'
import { getDaysInMonth } from 'date-fns'
import { NAIROBI_TZ } from '../../lib/safeToSpend'
import type { Budget } from './types'

/**
 * Pure daily-budget math for the Home circle. Integer cents in and out; no
 * floats, no string math (money rule 1). The circle is a DAILY gauge driven by
 * the user's own category budgets, not by income — "how much of today's
 * allowance is left".
 *
 * Daily target = sum(category monthly caps) ÷ days in the current Nairobi month,
 * floored so we never over-promise a fraction of a cent. It's flat across the
 * month and resets each day; the monthly category burn-down (BudgetsCard) is the
 * month-level view, and safe-to-spend is a separate forward-looking insight.
 *
 * Caveat (surfaced in the UI, not enforced here): a category budget is meant for
 * day-to-day spending buckets (Food, Transport…). One-off fixed bills (rent,
 * Sacco) belong in Recurring — dividing a rent cap across every day would inflate
 * the daily number to something never actually spent daily.
 */

function assertIntegerCents(value: number, label: string): void {
  if (!Number.isInteger(value)) {
    throw new TypeError(`dailyBudget: ${label} must be an integer number of cents, got ${value}`)
  }
}

/** Sum of all category budget caps (monthly, integer cents). */
export function monthlyBudgetCents(budgets: Pick<Budget, 'amount_cents'>[]): number {
  let total = 0
  for (const budget of budgets) {
    assertIntegerCents(budget.amount_cents, 'budget.amount_cents')
    total += budget.amount_cents
  }
  return total
}

/**
 * Today's flat spending target = monthly budget ÷ days in the current Nairobi
 * month, floored. Zero (no target) when there's no budget.
 */
export function dailyTargetCents(
  monthlyCents: number,
  now: Date = new Date(),
  timeZone: string = NAIROBI_TZ,
): number {
  assertIntegerCents(monthlyCents, 'monthlyCents')
  if (monthlyCents <= 0) return 0
  const daysInMonth = getDaysInMonth(new TZDate(now, timeZone))
  return Math.floor(monthlyCents / daysInMonth)
}

export interface DailySpendResult {
  /** Today's target (0 when no budget is set). */
  dailyTargetCents: number
  /** Expense spend booked today (transfers/income already excluded upstream). */
  spentTodayCents: number
  /** target − spent; negative once over today. */
  leftTodayCents: number
  /** spent ÷ target, clamped to [0, 1] for the arc; use `isOver` for the true state. */
  ratio: number
  /** True once today's spend has passed the target. */
  isOver: boolean
  /** False when no category budgets are set — the circle should teach, not show 0. */
  hasBudget: boolean
}

/** Compose the daily gauge from the month's budget total and today's spend. */
export function dailySpend(
  monthlyCents: number,
  spentTodayCents: number,
  now?: Date,
  timeZone?: string,
): DailySpendResult {
  assertIntegerCents(spentTodayCents, 'spentTodayCents')
  const target = dailyTargetCents(monthlyCents, now, timeZone)
  const hasBudget = target > 0
  const ratio = target > 0 ? Math.min(Math.max(spentTodayCents / target, 0), 1) : 0
  return {
    dailyTargetCents: target,
    spentTodayCents,
    leftTodayCents: target - spentTodayCents,
    ratio,
    isOver: hasBudget && spentTodayCents > target,
    hasBudget,
  }
}
