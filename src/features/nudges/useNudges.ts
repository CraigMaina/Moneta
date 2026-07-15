import { useMemo } from 'react'
import { TZDate } from '@date-fns/tz'
import { subDays } from 'date-fns'
import { NAIROBI_TZ } from '../../lib/safeToSpend'
import { useCategories, useTransactions } from '../transactions/queries'
import { useRecurringItems } from '../recurring/queries'
import { computeNudges, type Nudge } from './nudgeRules'
import { useNudgeStore } from './nudgeStore'

/**
 * Reads the last ~5 months of transactions (enough for the 3-month pace
 * baseline plus the current month and the 120-day unusual-spend history) plus
 * categories and recurring items, and derives the active, not-yet-dismissed
 * nudges. All computation is the pure `computeNudges`; this layer is only I/O +
 * memo + dismissal filtering.
 */
const NUDGE_WINDOW_DAYS = 155

export function useNudges(): Nudge[] {
  const from = useMemo(() => subDays(new TZDate(new Date(), NAIROBI_TZ), NUDGE_WINDOW_DAYS), [])
  const transactionsQuery = useTransactions({ from })
  const categoriesQuery = useCategories()
  const recurringQuery = useRecurringItems()
  const dismissed = useNudgeStore((state) => state.dismissed)

  return useMemo(() => {
    const transactions = transactionsQuery.data
    if (!transactions || transactions.length === 0) return []

    const categoryNameById = new Map<string, string>()
    for (const category of categoriesQuery.data ?? []) categoryNameById.set(category.id, category.name)

    const recurringMerchants = new Set<string>()
    for (const item of recurringQuery.data ?? []) {
      if (item.merchant) recurringMerchants.add(item.merchant.trim().toLowerCase())
    }

    const nudges = computeNudges({
      transactions,
      categoryNameById,
      recurringMerchants,
      now: new Date(),
    })
    return nudges.filter((n) => !dismissed.has(n.signature))
  }, [transactionsQuery.data, categoriesQuery.data, recurringQuery.data, dismissed])
}
