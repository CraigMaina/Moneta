import { TZDate } from '@date-fns/tz'
import { NAIROBI_TZ } from '../../lib/safeToSpend'

/**
 * `yyyy-MM-dd` calendar-date string for a given instant, in the given zone
 * (default Africa/Nairobi). `recurring_items.next_due_date` is a plain SQL
 * `date` with no timezone of its own, so it must be compared as a calendar
 * date computed in the user's zone, not via raw instant math — CLAUDE.md's
 * "never raw Date math across day boundaries" rule applies here exactly as
 * it does in `safeToSpend.ts`. Zero-padded `yyyy-MM-dd` strings compare
 * lexicographically in the same order as chronologically, so plain string
 * `>=`/`<=` comparisons (or Postgres `gte`/`lte` on a `date` column) are safe.
 */
export function toNairobiDateString(date: Date, timeZone: string = NAIROBI_TZ): string {
  const zoned = new TZDate(date, timeZone)
  const year = zoned.getFullYear()
  const month = String(zoned.getMonth() + 1).padStart(2, '0')
  const day = String(zoned.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
