import { TZDate } from '@date-fns/tz'
import { format } from 'date-fns'
import { NAIROBI_TZ } from '../../lib/safeToSpend'
import { toNairobiDateString } from './nairobiDate'
import type { Transaction } from './types'

/**
 * Day-grouping for the Transactions list (PRD screen 2). Pure and
 * exhaustively unit-tested — no component needs to re-derive this logic, and
 * a device-tz-independent Nairobi day boundary is worth getting right once,
 * not per-consumer (CLAUDE.md: "day boundaries ... use this zone regardless
 * of device clock").
 */

export interface TransactionDayGroup {
  /** `yyyy-MM-dd` Nairobi calendar date — stable across locales, sortable lexicographically. */
  dayKey: string
  /** "Today" / "Yesterday" / "Mon 13 Jul" — computed relative to `now`, in Africa/Nairobi. */
  label: string
  transactions: Transaction[]
}

function parseNairobiDayKey(dayKey: string): TZDate {
  const parts = dayKey.split('-')
  const year = Number(parts[0])
  const month = Number(parts[1])
  const day = Number(parts[2])
  // Noon avoids any midnight/DST-adjacent edge — Nairobi has no DST anyway,
  // but this keeps the same shape as `safeToSpend.ts`'s own TZDate usage.
  return new TZDate(year, month - 1, day, 12, 0, 0, 0, NAIROBI_TZ)
}

/** "Today" / "Yesterday" / a short weekday-date, all computed in Africa/Nairobi. */
export function relativeNairobiDayLabel(dayKey: string, now: Date = new Date()): string {
  const todayKey = toNairobiDateString(now)
  if (dayKey === todayKey) return 'Today'

  const yesterdayKey = toNairobiDateString(new Date(now.getTime() - 24 * 60 * 60 * 1000))
  if (dayKey === yesterdayKey) return 'Yesterday'

  return format(parseNairobiDayKey(dayKey), 'EEE d MMM')
}

/**
 * Groups transactions by their Nairobi calendar day, preserving input order
 * within and across groups (the caller — `useTransactions()` — already
 * returns rows `occurred_at desc`, so passing that straight through yields
 * newest-day-first groups with no re-sort needed here).
 */
export function groupTransactionsByNairobiDay(
  transactions: Transaction[],
  now: Date = new Date(),
): TransactionDayGroup[] {
  const groups: TransactionDayGroup[] = []
  const groupByDayKey = new Map<string, TransactionDayGroup>()

  for (const txn of transactions) {
    const dayKey = toNairobiDateString(new Date(txn.occurred_at))
    let group = groupByDayKey.get(dayKey)
    if (!group) {
      group = { dayKey, label: relativeNairobiDayLabel(dayKey, now), transactions: [] }
      groupByDayKey.set(dayKey, group)
      groups.push(group)
    }
    group.transactions.push(txn)
  }

  return groups
}
