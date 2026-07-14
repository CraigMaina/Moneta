import { TZDate } from '@date-fns/tz'
import { format } from 'date-fns'
import { NAIROBI_TZ } from '../../lib/safeToSpend'

/**
 * "Jul 11, 11:00 AM" — `parsed.occurredAt` (a correct ISO instant) rendered
 * as Africa/Nairobi wall-clock time for the confirmation card. Goes through
 * `TZDate` exactly like `nairobiDate.ts` does — CLAUDE.md forbids raw `Date`
 * math/formatting across a day boundary regardless of device zone.
 */
export function formatOccurredAt(iso: string): string {
  const zoned = new TZDate(new Date(iso), NAIROBI_TZ)
  return format(zoned, 'MMM d, h:mm a')
}
