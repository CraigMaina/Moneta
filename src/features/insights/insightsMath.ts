import { TZDate } from '@date-fns/tz'
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

/**
 * Shared aggregation core. `keyOf` buckets a transaction (by Nairobi month or
 * week); we keep only the rows whose bucket equals `periodKey`. Transfers are
 * never counted (money rule 3). Used by both `monthInsights` and `weekInsights`.
 */
function aggregatePeriod(
  transactions: Transaction[],
  periodKey: string,
  keyOf: (iso: string) => string,
  feeCategoryId: string | null,
): Omit<MonthInsights, 'monthKey'> {
  let incomeCents = 0
  let expenseCents = 0
  let expenseCount = 0
  const byCategoryMap = new Map<string | null, number>()

  for (const txn of transactions) {
    if (txn.kind === 'transfer') continue
    if (keyOf(txn.occurred_at) !== periodKey) continue

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

  return { incomeCents, expenseCents, netCents: incomeCents - expenseCents, feesCents, byCategory, expenseCount }
}

/** Income/expense/fees/category-breakdown for a single Nairobi month. */
export function monthInsights(
  transactions: Transaction[],
  monthKey: string,
  options: MonthInsightsOptions = {},
): MonthInsights {
  const { feeCategoryId = null, timeZone = NAIROBI_TZ } = options
  return { monthKey, ...aggregatePeriod(transactions, monthKey, (iso) => nairobiMonthKey(iso, timeZone), feeCategoryId) }
}

/** Income/expense/fees/category-breakdown for a single Nairobi week (Monday-start). */
export function weekInsights(
  transactions: Transaction[],
  weekKey: string,
  options: MonthInsightsOptions = {},
): MonthInsights {
  const { feeCategoryId = null, timeZone = NAIROBI_TZ } = options
  return { monthKey: weekKey, ...aggregatePeriod(transactions, weekKey, (iso) => nairobiWeekKey(iso, timeZone), feeCategoryId) }
}

export interface MonthTotals {
  monthKey: string
  incomeCents: number
  expenseCents: number
}

/** In/out totals per period, in the given key order (for the trend chart). */
function periodSeries(
  transactions: Transaction[],
  periodKeys: string[],
  keyOf: (iso: string) => string,
): MonthTotals[] {
  const income = new Map<string, number>()
  const expense = new Map<string, number>()
  const wanted = new Set(periodKeys)

  for (const txn of transactions) {
    if (txn.kind === 'transfer') continue
    const key = keyOf(txn.occurred_at)
    if (!wanted.has(key)) continue
    if (txn.kind === 'income') income.set(key, (income.get(key) ?? 0) + txn.amount_cents)
    else expense.set(key, (expense.get(key) ?? 0) + txn.amount_cents)
  }

  return periodKeys.map((monthKey) => ({
    monthKey,
    incomeCents: income.get(monthKey) ?? 0,
    expenseCents: expense.get(monthKey) ?? 0,
  }))
}

/** In/out totals per month, in the given month-key order (for the trend chart). */
export function monthlySeries(
  transactions: Transaction[],
  monthKeys: string[],
  timeZone: string = NAIROBI_TZ,
): MonthTotals[] {
  return periodSeries(transactions, monthKeys, (iso) => nairobiMonthKey(iso, timeZone))
}

/** In/out totals per week, in the given week-key order (for the trend chart). */
export function weeklySeries(
  transactions: Transaction[],
  weekKeys: string[],
  timeZone: string = NAIROBI_TZ,
): MonthTotals[] {
  return periodSeries(transactions, weekKeys, (iso) => nairobiWeekKey(iso, timeZone))
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

// --- Weekly (Nairobi, Monday-start) ---------------------------------------
//
// A week is keyed by the calendar date of its Monday (`yyyy-MM-dd`). We resolve
// the transaction's Nairobi calendar date first, then do weekday arithmetic on a
// UTC-noon anchor for that date — noon can never slip to an adjacent day, so the
// weekday (and thus the week bucket) is stable regardless of the device clock.

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const pad2 = (n: number) => String(n).padStart(2, '0')

/** A UTC-noon anchor for a `yyyy-MM-dd` calendar date (safe for weekday math). */
function noonAnchor(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), 12))
}

function anchorToKey(anchor: Date): string {
  return `${anchor.getUTCFullYear()}-${pad2(anchor.getUTCMonth() + 1)}-${pad2(anchor.getUTCDate())}`
}

/** The Monday (Nairobi) starting the week `iso` falls in, as `yyyy-MM-dd`. */
export function nairobiWeekKey(occurredAtIso: string, timeZone: string = NAIROBI_TZ): string {
  const dateStr = toNairobiDateString(new Date(occurredAtIso), timeZone)
  const anchor = noonAnchor(dateStr)
  const backToMonday = (anchor.getUTCDay() + 6) % 7 // Sun=0 → 6 days back; Mon=1 → 0
  anchor.setUTCDate(anchor.getUTCDate() - backToMonday)
  return anchorToKey(anchor)
}

/** The `count` most recent Monday-start week keys ending at `now`'s week, oldest-first. */
export function recentWeekKeys(now: Date, count: number, timeZone: string = NAIROBI_TZ): string[] {
  const anchor = noonAnchor(nairobiWeekKey(now.toISOString(), timeZone))
  const keys: string[] = []
  for (let i = 0; i < count; i++) {
    keys.unshift(anchorToKey(anchor))
    anchor.setUTCDate(anchor.getUTCDate() - 7)
  }
  return keys
}

/** Human label for a week key (`yyyy-MM-dd` Monday → e.g. "6–12 Jul" / "29 Jun – 5 Jul"). */
export function weekKeyLabel(weekKey: string): string {
  const start = noonAnchor(weekKey)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 6)
  const sM = SHORT_MONTHS[start.getUTCMonth()] ?? '?'
  const eM = SHORT_MONTHS[end.getUTCMonth()] ?? '?'
  if (start.getUTCMonth() === end.getUTCMonth()) {
    return `${start.getUTCDate()}–${end.getUTCDate()} ${eM}`
  }
  return `${start.getUTCDate()} ${sM} – ${end.getUTCDate()} ${eM}`
}

/** Short label for a chart axis (`yyyy-MM-dd` Monday → e.g. "6 Jul"). */
export function weekKeyShortLabel(weekKey: string): string {
  const start = noonAnchor(weekKey)
  return `${start.getUTCDate()} ${SHORT_MONTHS[start.getUTCMonth()] ?? '?'}`
}

// --- Granularity dispatchers ----------------------------------------------
//
// Thin wrappers so the Insights screen can run one code path against either
// grain. The `MonthTotals.monthKey` / `MonthInsights.monthKey` fields carry a
// week key unchanged when granularity is 'week' (the shape is period-agnostic).

export type Granularity = 'month' | 'week'

/** The rough number of a monthly amount that applies to one week (52 weeks / 12 months). */
export const WEEKS_PER_MONTH = 52 / 12

export function nairobiPeriodKey(iso: string, granularity: Granularity, timeZone: string = NAIROBI_TZ): string {
  return granularity === 'week' ? nairobiWeekKey(iso, timeZone) : nairobiMonthKey(iso, timeZone)
}

export function recentPeriodKeys(now: Date, count: number, granularity: Granularity, timeZone: string = NAIROBI_TZ): string[] {
  return granularity === 'week' ? recentWeekKeys(now, count, timeZone) : recentMonthKeys(now, count, timeZone)
}

export function periodInsights(
  transactions: Transaction[],
  periodKey: string,
  granularity: Granularity,
  options: MonthInsightsOptions = {},
): MonthInsights {
  return granularity === 'week' ? weekInsights(transactions, periodKey, options) : monthInsights(transactions, periodKey, options)
}

export function periodSeriesFor(
  transactions: Transaction[],
  periodKeys: string[],
  granularity: Granularity,
  timeZone: string = NAIROBI_TZ,
): MonthTotals[] {
  return granularity === 'week' ? weeklySeries(transactions, periodKeys, timeZone) : monthlySeries(transactions, periodKeys, timeZone)
}

export function periodKeyLabel(periodKey: string, granularity: Granularity): string {
  return granularity === 'week' ? weekKeyLabel(periodKey) : monthKeyLabel(periodKey)
}

export function periodKeyShortLabel(periodKey: string, granularity: Granularity): string {
  return granularity === 'week' ? weekKeyShortLabel(periodKey) : monthKeyShortLabel(periodKey)
}

/** The first instant (Nairobi) of a period, for a query lower bound. */
export function periodStartDate(periodKey: string, granularity: Granularity): Date {
  if (granularity === 'week') {
    const [y, m, d] = periodKey.split('-').map(Number)
    return new TZDate(Number(y), Number(m) - 1, Number(d), 0, 0, 0, 0, NAIROBI_TZ)
  }
  const [y, m] = periodKey.split('-').map(Number)
  return new TZDate(Number(y), Number(m) - 1, 1, 0, 0, 0, 0, NAIROBI_TZ)
}
