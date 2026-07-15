import { NAIROBI_TZ } from '../../lib/safeToSpend'
import { toNairobiDateString } from '../transactions/nairobiDate'
import type { Transaction } from '../transactions/types'

/**
 * Pure aggregation for the Insights screen (PRD F10). No I/O, no formatting —
 * integer cents in, integer cents out; `formatKES` happens only at the display
 * edge (CLAUDE.md money rules). Two invariants carried through everything here:
 *
 *   1. Transfers are NEVER counted — they're money moving between the user's
 *      own accounts, not income or expense (CLAUDE.md money rule 3). Every
 *      sum below filters `kind !== 'transfer'`.
 *   2. Months are Africa/Nairobi calendar months (`yyyy-MM`), independent of
 *      the device clock, so a transaction near midnight lands in the same
 *      month the user would put it in (CLAUDE.md day-boundary rule).
 */

/** The Nairobi calendar month (`yyyy-MM`) an instant falls in. */
export function nairobiMonthKey(occurredAtIso: string, timeZone: string = NAIROBI_TZ): string {
  return toNairobiDateString(new Date(occurredAtIso), timeZone).slice(0, 7)
}

/**
 * The `count` most recent Nairobi month keys ending at (and including) `now`'s
 * month, oldest-first. Pure integer month arithmetic (no `Date` math across
 * boundaries), so it never drifts a month at a DST/zone edge.
 */
export function recentMonthKeys(now: Date, count: number, timeZone: string = NAIROBI_TZ): string[] {
  const current = toNairobiDateString(now, timeZone).slice(0, 7)
  const [yearStr, monthStr] = current.split('-')
  let year = Number(yearStr)
  let month = Number(monthStr)
  const keys: string[] = []
  for (let i = 0; i < count; i++) {
    keys.unshift(`${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`)
    month -= 1
    if (month === 0) {
      month = 12
      year -= 1
    }
  }
  return keys
}

/** One expense category's share of a month (id `null` = uncategorized). */
export interface CategorySlice {
  categoryId: string | null
  amountCents: number
}

export interface MonthInsights {
  monthKey: string
  incomeCents: number
  expenseCents: number
  /** income − expense; may be negative. */
  netCents: number
  /** Spend booked to the fee category this month (0 when no fee category is known). */
  feesCents: number
  /** Expense breakdown, largest first; excludes transfers and income. */
  byCategory: CategorySlice[]
  expenseCount: number
}

export interface MonthInsightsOptions {
  /** The "Fees & Fuliza charges" category id, so the fees spotlight can total it. */
  feeCategoryId?: string | null
  timeZone?: string
}

/** Income/expense/fees/category-breakdown for a single Nairobi month. */
export function monthInsights(
  transactions: Transaction[],
  monthKey: string,
  options: MonthInsightsOptions = {},
): MonthInsights {
  const { feeCategoryId = null, timeZone = NAIROBI_TZ } = options

  let incomeCents = 0
  let expenseCents = 0
  let expenseCount = 0
  const byCategoryMap = new Map<string | null, number>()

  for (const txn of transactions) {
    if (txn.kind === 'transfer') continue
    if (nairobiMonthKey(txn.occurred_at, timeZone) !== monthKey) continue

    if (txn.kind === 'income') {
      incomeCents += txn.amount_cents
    } else {
      expenseCents += txn.amount_cents
      expenseCount += 1
      const key = txn.category_id ?? null
      byCategoryMap.set(key, (byCategoryMap.get(key) ?? 0) + txn.amount_cents)
    }
  }

  const byCategory: CategorySlice[] = [...byCategoryMap.entries()]
    .map(([categoryId, amountCents]) => ({ categoryId, amountCents }))
    // Largest first; ties broken by a stable id order so output is deterministic.
    .sort((a, b) => b.amountCents - a.amountCents || String(a.categoryId).localeCompare(String(b.categoryId)))

  const feesCents = feeCategoryId ? (byCategoryMap.get(feeCategoryId) ?? 0) : 0

  return {
    monthKey,
    incomeCents,
    expenseCents,
    netCents: incomeCents - expenseCents,
    feesCents,
    byCategory,
    expenseCount,
  }
}

export interface MonthTotals {
  monthKey: string
  incomeCents: number
  expenseCents: number
}

/** In/out totals per month, in the given month-key order (for the trend chart). */
export function monthlySeries(
  transactions: Transaction[],
  monthKeys: string[],
  timeZone: string = NAIROBI_TZ,
): MonthTotals[] {
  const income = new Map<string, number>()
  const expense = new Map<string, number>()
  const wanted = new Set(monthKeys)

  for (const txn of transactions) {
    if (txn.kind === 'transfer') continue
    const key = nairobiMonthKey(txn.occurred_at, timeZone)
    if (!wanted.has(key)) continue
    if (txn.kind === 'income') income.set(key, (income.get(key) ?? 0) + txn.amount_cents)
    else expense.set(key, (expense.get(key) ?? 0) + txn.amount_cents)
  }

  return monthKeys.map((monthKey) => ({
    monthKey,
    incomeCents: income.get(monthKey) ?? 0,
    expenseCents: expense.get(monthKey) ?? 0,
  }))
}

/**
 * Collapse a category breakdown to at most `maxSlices` visible slices, folding
 * the long tail into a single "Other" bucket (id `'__other__'`) so the donut
 * stays legible. Returns slices already largest-first.
 */
export const OTHER_SLICE_ID = '__other__'

export function withOtherBucket(slices: CategorySlice[], maxSlices: number): CategorySlice[] {
  if (slices.length <= maxSlices) return slices
  const head = slices.slice(0, maxSlices - 1)
  const tailCents = slices.slice(maxSlices - 1).reduce((sum, s) => sum + s.amountCents, 0)
  return [...head, { categoryId: OTHER_SLICE_ID, amountCents: tailCents }]
}

/** Human label for the display month key (`yyyy-MM` → e.g. "July 2026"). */
export function monthKeyLabel(monthKey: string): string {
  const parts = monthKey.split('-')
  const year = Number(parts[0])
  const month = Number(parts[1])
  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ]
  return `${MONTHS[month - 1] ?? '?'} ${year}`
}

/** Short label for a chart axis (`yyyy-MM` → e.g. "Jul"). */
export function monthKeyShortLabel(monthKey: string): string {
  const month = Number(monthKey.split('-')[1])
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return MONTHS[month - 1] ?? '?'
}
