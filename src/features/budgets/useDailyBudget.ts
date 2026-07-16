import { useMemo, useState } from 'react'
import { TZDate } from '@date-fns/tz'
import { NAIROBI_TZ } from '../../lib/safeToSpend'
import { toNairobiDateString } from '../transactions/nairobiDate'
import { useTransactions } from '../transactions/queries'
import { useBudgets } from './queries'
import { dailySpend, monthlyBudgetCents, type DailySpendResult } from './dailyBudget'

/**
 * Feeds the Home circle: the daily spending gauge driven by the user's own
 * category budgets. Composes `useBudgets` (summed to a monthly total) with
 * today's expense spend, then runs the pure `dailySpend` math. Transfer/income
 * exclusion happens in the filter here (only `expense` counts) — the circle is
 * a spend gauge.
 */

export interface UseDailyBudgetOptions {
  /** Reference "now"; defaults to mount time (stable across re-renders). Tests pin it. */
  now?: Date
}

export interface UseDailyBudgetResult {
  data: DailySpendResult | undefined
  isLoading: boolean
  isError: boolean
}

/** Start-of-day (00:00) for an instant, in Nairobi — the lower bound for "today". */
function nairobiDayStart(now: Date): TZDate {
  const local = new TZDate(now, NAIROBI_TZ)
  return new TZDate(local.getFullYear(), local.getMonth(), local.getDate(), 0, 0, 0, 0, NAIROBI_TZ)
}

export function useDailyBudget(options: UseDailyBudgetOptions = {}): UseDailyBudgetResult {
  const [mountedNow] = useState(() => new Date())
  const now = options.now ?? mountedNow
  const todayStr = toNairobiDateString(now)

  const budgetsQuery = useBudgets()
  const from = useMemo(() => nairobiDayStart(now), [todayStr]) // eslint-disable-line react-hooks/exhaustive-deps
  const txnsQuery = useTransactions({ from })

  const isLoading = budgetsQuery.isLoading || txnsQuery.isLoading
  const isError = budgetsQuery.isError || txnsQuery.isError

  const data = useMemo(() => {
    if (!budgetsQuery.isSuccess || !txnsQuery.isSuccess) return undefined
    const monthly = monthlyBudgetCents(budgetsQuery.data)
    let spentToday = 0
    for (const txn of txnsQuery.data) {
      if (txn.kind === 'expense' && toNairobiDateString(new Date(txn.occurred_at)) === todayStr) {
        spentToday += txn.amount_cents
      }
    }
    return dailySpend(monthly, spentToday, now)
  }, [budgetsQuery.isSuccess, budgetsQuery.data, txnsQuery.isSuccess, txnsQuery.data, todayStr, now])

  return { data, isLoading, isError }
}
