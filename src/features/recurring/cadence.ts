import { addDays, addMonths, format } from 'date-fns'
import { TZDate } from '@date-fns/tz'
import { NAIROBI_TZ } from '../../lib/safeToSpend'
import { toNairobiDateString } from '../transactions/nairobiDate'

/** A human due label — "Overdue" / "Due today" / "Due tomorrow" / "Due 15 Jul". */
export function dueLabel(dueDate: string, now: Date = new Date()): string {
  const today = toNairobiDateString(now)
  const tomorrow = toNairobiDateString(addDays(now, 1))
  if (dueDate < today) return 'Overdue'
  if (dueDate === today) return 'Due today'
  if (dueDate === tomorrow) return 'Due tomorrow'
  return `Due ${format(new TZDate(`${dueDate}T12:00:00`, NAIROBI_TZ), 'd MMM')}`
}

/**
 * Pure cadence + due-date logic for recurring items (PRD F6). `next_due_date`
 * is a plain SQL `date` (no timezone), so all math here is calendar-date math
 * in Africa/Nairobi — never raw instant arithmetic (CLAUDE.md day-boundary
 * rule). Cadences are a small closed set stored as a keyword in
 * `recurring_items.cadence`.
 */

export type Cadence = 'weekly' | 'monthly'

export const CADENCES: { value: Cadence; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'weekly', label: 'Weekly' },
]

export function isCadence(value: string): value is Cadence {
  return value === 'weekly' || value === 'monthly'
}

export function cadenceLabel(value: string): string {
  return CADENCES.find((c) => c.value === value)?.label ?? 'Repeats'
}

/** Parse a `yyyy-MM-dd` string to a noon-Nairobi `TZDate` (noon dodges any midnight edge). */
function parseDueDate(dateString: string): TZDate {
  const parts = dateString.split('-')
  const year = Number(parts[0])
  const month = Number(parts[1])
  const day = Number(parts[2])
  return new TZDate(year, month - 1, day, 12, 0, 0, 0, NAIROBI_TZ)
}

/** The next due date (`yyyy-MM-dd`) after `dateString`, advanced by one cadence step. */
export function advanceDueDate(dateString: string, cadence: string): string {
  const base = parseDueDate(dateString)
  const next = cadence === 'weekly' ? addDays(base, 7) : addMonths(base, 1)
  return format(next, 'yyyy-MM-dd')
}

export type DueStatus = 'overdue' | 'due-soon' | 'upcoming'

/**
 * Where a bill sits relative to now (PRD F6: remind 2 days before due).
 * `overdue` past its date, `due-soon` within the next `soonDays` days
 * (default 2, inclusive of today), else `upcoming`. Compares `yyyy-MM-dd`
 * strings, which sort chronologically.
 */
export function dueStatus(dueDate: string, now: Date = new Date(), soonDays = 2): DueStatus {
  const today = toNairobiDateString(now)
  if (dueDate < today) return 'overdue'
  const soonCutoff = toNairobiDateString(addDays(now, soonDays))
  if (dueDate <= soonCutoff) return 'due-soon'
  return 'upcoming'
}

/** True when a bill is overdue or due within `soonDays` — i.e. worth surfacing as a reminder. */
export function isDueSoonOrOverdue(dueDate: string, now: Date = new Date(), soonDays = 2): boolean {
  return dueStatus(dueDate, now, soonDays) !== 'upcoming'
}
