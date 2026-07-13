/**
 * Safe-to-spend — the hero number, and the most credibility-critical code in
 * the app (PRD §4.5, §10). One wrong number destroys trust, so this is a PURE
 * function with no I/O, exhaustively tested. It NEVER lies:
 *
 *  - Transfers never affect it (they move money between the user's own
 *    accounts; direction lives in `kind`). Only `income` and `expense` count.
 *  - Amounts are integer cents throughout; no floats, no string math.
 *  - Day boundaries and the cycle period are computed in Africa/Nairobi,
 *    regardless of the device clock/timezone.
 *
 * PRD formula:
 *   safe_to_spend_today =
 *     ( expected_income_this_period
 *       − fixed_bills_this_period
 *       − planned_goal_contributions_this_period
 *       − variable_spend_so_far_this_period )
 *     ÷ days_remaining_in_period (inclusive of today)
 *
 * Two deliberate semantics (recorded in DECISIONS.md):
 *  1. `expected_income` = max(user-declared typical income, income actually
 *     received so far this period) — a bonus RAISES the number, never lowers it.
 *  2. `fixed_bills_this_period` is passed as bills still DUE later in the period
 *     (not yet paid). Bills already paid are ordinary expenses and are already
 *     inside `variable_spend_so_far`; counting them in both would double-count,
 *     so the caller passes only the not-yet-paid remainder here.
 *
 * When the pool is negative the user is over budget for the period. Per PRD
 * §4.5 the UI then shows a calm "You're KES X over this month" (a period TOTAL,
 * not a per-day figure), so in that case `safeToSpendCents` is the negative
 * pool itself, not the pool divided by days remaining.
 */

import { TZDate } from '@date-fns/tz'
import { differenceInCalendarDays } from 'date-fns'

export const NAIROBI_TZ = 'Africa/Nairobi'

export type TxnKind = 'income' | 'expense' | 'transfer'

export interface CalcTxn {
  kind: TxnKind
  /** Integer cents, always positive (direction is carried by `kind`). */
  amountCents: number
  /** The instant the transaction occurred (any timezone; compared as an instant). */
  occurredAt: Date
}

export interface SafeToSpendInput {
  /** The reference "now" instant. */
  now: Date
  /** Day of month the cycle starts, 1–28 (e.g. 25 for a salary that lands on the 25th). Default 1 (calendar month). */
  cycleAnchorDay?: number
  /** User-declared typical income for the period, integer cents. */
  expectedIncomeCents: number
  /** All transactions; the function filters to the current period itself. */
  transactions: CalcTxn[]
  /** Fixed bills still DUE later in the period and not yet paid, integer cents. Default 0. */
  upcomingFixedBillsCents?: number
  /** Goal contributions planned for the remainder of the period, integer cents. Default 0. */
  plannedGoalContributionsCents?: number
  /** Timezone for all day/period math. Default Africa/Nairobi. */
  timeZone?: string
}

export interface SafeToSpendResult {
  /** The hero value. Per-day allowance when on track (≥ 0); the negative period total when over. */
  safeToSpendCents: number
  /** True when the user is over budget for the period (pool < 0). */
  isOver: boolean
  /** Inclusive start instant of the current period (00:00 in the zone, on the anchor day). */
  periodStart: Date
  /** Inclusive end instant of the current period (23:59:59.999 in the zone, day before next anchor). */
  periodEnd: Date
  /** Calendar days from today through periodEnd, inclusive of today (≥ 1). */
  daysRemaining: number
  /** The expected income actually used = max(declared, received so far). */
  expectedIncomeCents: number
  /** Total income received so far this period (income kind only; transfers excluded). */
  incomeSoFarCents: number
  /** Total variable spend so far this period (expense kind only; transfers excluded). */
  variableSpentCents: number
  /** The remaining pool before dividing by days (can be negative). */
  poolCents: number
}

function assertIntegerCents(value: number, label: string): void {
  if (!Number.isInteger(value)) {
    throw new TypeError(`safeToSpend: ${label} must be an integer number of cents, got ${value}`)
  }
}

/**
 * The current period [start, end] for a given instant and cycle anchor, in the
 * given timezone. If today is on/after the anchor day, the period started on
 * this month's anchor; otherwise it started on last month's anchor. The period
 * ends the instant before the next anchor.
 */
export function currentPeriod(
  now: Date,
  cycleAnchorDay = 1,
  timeZone = NAIROBI_TZ,
): { periodStart: Date; periodEnd: Date } {
  if (!Number.isInteger(cycleAnchorDay) || cycleAnchorDay < 1 || cycleAnchorDay > 28) {
    throw new RangeError(`safeToSpend: cycleAnchorDay must be an integer 1–28, got ${cycleAnchorDay}`)
  }

  const local = new TZDate(now, timeZone)
  const year = local.getFullYear()
  const month = local.getMonth()
  const day = local.getDate()

  // Which month did the current cycle start in?
  let startYear = year
  let startMonth = month
  if (day < cycleAnchorDay) {
    startMonth -= 1
    if (startMonth < 0) {
      startMonth = 11
      startYear -= 1
    }
  }

  const periodStart = new TZDate(startYear, startMonth, cycleAnchorDay, 0, 0, 0, 0, timeZone)
  // Next anchor; JS Date normalizes a month index of 12 into next January.
  const nextAnchor = new TZDate(startYear, startMonth + 1, cycleAnchorDay, 0, 0, 0, 0, timeZone)
  const periodEnd = new TZDate(nextAnchor.getTime() - 1, timeZone)

  return { periodStart, periodEnd }
}

export function calcSafeToSpend(input: SafeToSpendInput): SafeToSpendResult {
  const {
    now,
    cycleAnchorDay = 1,
    expectedIncomeCents,
    transactions,
    upcomingFixedBillsCents = 0,
    plannedGoalContributionsCents = 0,
    timeZone = NAIROBI_TZ,
  } = input

  assertIntegerCents(expectedIncomeCents, 'expectedIncomeCents')
  assertIntegerCents(upcomingFixedBillsCents, 'upcomingFixedBillsCents')
  assertIntegerCents(plannedGoalContributionsCents, 'plannedGoalContributionsCents')

  const { periodStart, periodEnd } = currentPeriod(now, cycleAnchorDay, timeZone)
  const startMs = periodStart.getTime()
  const nowMs = now.getTime()

  let incomeSoFarCents = 0
  let variableSpentCents = 0

  for (const txn of transactions) {
    // Transfers never affect the number — this is guarded here, not by discipline.
    if (txn.kind === 'transfer') continue
    assertIntegerCents(txn.amountCents, 'transaction.amountCents')

    const occurredMs = txn.occurredAt.getTime()
    // Only what has actually happened this period, up to now.
    if (occurredMs < startMs || occurredMs > nowMs) continue

    if (txn.kind === 'income') incomeSoFarCents += txn.amountCents
    else if (txn.kind === 'expense') variableSpentCents += txn.amountCents
  }

  // A bonus raises the number; declared income is the floor, not the cap.
  const effectiveIncomeCents = Math.max(expectedIncomeCents, incomeSoFarCents)

  const todayStart = startOfZonedDay(now, timeZone)
  // Inclusive of today: e.g. today IS the last day → 1 day remaining.
  const daysRemaining = Math.max(1, differenceInCalendarDays(periodEnd, todayStart) + 1)

  const poolCents =
    effectiveIncomeCents - upcomingFixedBillsCents - plannedGoalContributionsCents - variableSpentCents

  const isOver = poolCents < 0
  // On track: floor the per-day allowance so we never over-promise a fraction of
  // a cent. Over budget: show the negative period total (the UI renders "over").
  const safeToSpendCents = isOver ? poolCents : Math.floor(poolCents / daysRemaining)

  return {
    safeToSpendCents,
    isOver,
    periodStart,
    periodEnd,
    daysRemaining,
    expectedIncomeCents: effectiveIncomeCents,
    incomeSoFarCents,
    variableSpentCents,
    poolCents,
  }
}

/** Start-of-day (00:00) for the given instant in the given zone, as an instant. */
function startOfZonedDay(now: Date, timeZone: string): TZDate {
  const local = new TZDate(now, timeZone)
  return new TZDate(local.getFullYear(), local.getMonth(), local.getDate(), 0, 0, 0, 0, timeZone)
}
