import { useMemo, useState } from 'react'
import { calcSafeToSpend, currentPeriod, type CalcTxn, type SafeToSpendResult } from '../../lib/safeToSpend'
import { toNairobiDateString } from './nairobiDate'
import { useProfile, useTransactions, useUpcomingRecurringBills } from './queries'

/**
 * THE money-path seam (see CLAUDE.md brief). Composes:
 *   - `profiles.expected_income_cents` / `cycle_anchor_day` -> the calc's
 *     `expectedIncomeCents` / `cycleAnchorDay` (the calc itself takes
 *     `max(declared, received-so-far)` — this hook passes the declared
 *     figure through unmodified, never pre-maxed).
 *   - This period's transactions (fetched bounded to `[periodStart, now]` for
 *     efficiency) -> `CalcTxn[]`. Transfer-exclusion happens inside
 *     `calcSafeToSpend` itself, not here — this hook never filters by kind.
 *   - `recurring_items` (kind: 'expense') whose `next_due_date` falls in
 *     `[now, periodEnd]`, summed -> `upcomingFixedBillsCents`. This is
 *     deliberately the NOT-YET-DUE remainder, not the full period's bills —
 *     see DECISIONS.md "safe-to-spend calculator semantics" for why counting
 *     the full month here would double-count already-paid bills (which are
 *     already ordinary `expense` rows inside the transactions sum above).
 *   - `plannedGoalContributionsCents` — no plan model exists yet (Phase 2);
 *     defaults to 0 per the brief ("0 is fine for now").
 */

export interface UseSafeToSpendOptions {
  /** Reference "now" instant. Defaults to the instant this hook first mounted
   * (stable across re-renders so query keys/memoization don't thrash); pass
   * an explicit value in tests for a deterministic result. */
  now?: Date
  /** Planned goal contributions for the remainder of the period, integer
   * cents. Defaults to 0 (no goal-planning model in Phase 2 yet). */
  plannedGoalContributionsCents?: number
}

/**
 * The calc result plus the two figures the `SafeToSpendHero` arc needs but the
 * pure calculator (which is period-scoped, not day-scoped) doesn't expose:
 *  - `spentTodayCents`: today's (Nairobi) expense spend, transfers excluded.
 *  - `dailyBudgetCents`: today's gross allowance = max(0, safeToSpend) +
 *    spentToday, so the arc reads spentToday / dailyBudget. When over budget
 *    (safeToSpend < 0) this reduces to spentToday, i.e. a full arc — matching
 *    the hero's own over-state, with no divide-by-zero.
 */
export interface SafeToSpendView extends SafeToSpendResult {
  spentTodayCents: number
  dailyBudgetCents: number
}

export interface UseSafeToSpendResult {
  data: SafeToSpendView | undefined
  isLoading: boolean
  isError: boolean
  error: unknown
}

export function useSafeToSpend(options: UseSafeToSpendOptions = {}): UseSafeToSpendResult {
  const { plannedGoalContributionsCents = 0 } = options

  // Stable per-mount unless the caller pins an explicit `now` (tests do).
  const [mountedNow] = useState(() => new Date())
  const now = options.now ?? mountedNow

  const profileQuery = useProfile()
  // If the profile row doesn't exist yet, fall back to the same defaults the
  // DB column defaults use (0 declared income, calendar-month anchor) rather
  // than blocking indefinitely — see DECISIONS.md for this assumption.
  const cycleAnchorDay = profileQuery.data?.cycle_anchor_day ?? 1
  const expectedIncomeCents = profileQuery.data?.expected_income_cents ?? 0

  const { periodStart, periodEnd } = useMemo(() => currentPeriod(now, cycleAnchorDay), [now, cycleAnchorDay])

  const transactionsQuery = useTransactions({ from: periodStart, to: now })
  const recurringQuery = useUpcomingRecurringBills({ from: now, to: periodEnd })

  const isLoading = profileQuery.isLoading || transactionsQuery.isLoading || recurringQuery.isLoading
  const isError = profileQuery.isError || transactionsQuery.isError || recurringQuery.isError
  const error = profileQuery.error ?? transactionsQuery.error ?? recurringQuery.error

  const ready = profileQuery.isSuccess && transactionsQuery.isSuccess && recurringQuery.isSuccess

  const data = useMemo(() => {
    if (!ready || !transactionsQuery.data || !recurringQuery.data) return undefined

    const calcTxns: CalcTxn[] = transactionsQuery.data.map((t) => ({
      kind: t.kind,
      amountCents: t.amount_cents,
      occurredAt: new Date(t.occurred_at),
    }))

    const upcomingFixedBillsCents = recurringQuery.data.reduce((sum, item) => sum + item.amount_cents, 0)

    const result = calcSafeToSpend({
      now,
      cycleAnchorDay,
      expectedIncomeCents,
      transactions: calcTxns,
      upcomingFixedBillsCents,
      plannedGoalContributionsCents,
    })

    // Today's spend (Nairobi day), transfers excluded — for the hero arc.
    const todayStr = toNairobiDateString(now)
    let spentTodayCents = 0
    for (const t of calcTxns) {
      if (t.kind === 'expense' && toNairobiDateString(t.occurredAt) === todayStr) {
        spentTodayCents += t.amountCents
      }
    }
    const dailyBudgetCents = Math.max(0, result.safeToSpendCents) + spentTodayCents

    return { ...result, spentTodayCents, dailyBudgetCents }
  }, [ready, transactionsQuery.data, recurringQuery.data, now, cycleAnchorDay, expectedIncomeCents, plannedGoalContributionsCents])

  return { data, isLoading, isError, error }
}
