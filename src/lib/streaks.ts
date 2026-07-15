import { differenceInCalendarDays, startOfWeek } from 'date-fns'
import { TZDate } from '@date-fns/tz'
import { NAIROBI_TZ } from './safeToSpend'

/**
 * Pure logging-streak logic (PRD F8). No I/O — the mutation layer reads/writes
 * the `streaks` row; this decides the new state. Two rules from the brief:
 *
 *   - A day "counts" when the user logs ≥1 transaction OR confirms "no spend
 *     today" (the caller decides that; this just advances the counter).
 *   - Streak freeze: ONE missed day per week is auto-forgiven (habit research —
 *     brittle streaks cause abandonment). Freezes reset at the start of each
 *     week (Monday, Africa/Nairobi).
 *
 * All dates are `yyyy-MM-dd` Nairobi calendar dates, so day/week boundaries are
 * device-clock-independent (CLAUDE.md).
 */

export interface StreakState {
  currentCount: number
  longestCount: number
  /** The last date that counted, `yyyy-MM-dd`, or null if never. */
  lastCountedDate: string | null
  freezesUsedThisWeek: number
}

const FREEZES_PER_WEEK = 1

function parseDay(dateString: string): TZDate {
  const [y, m, d] = dateString.split('-').map(Number)
  return new TZDate(Number(y), Number(m) - 1, Number(d), 12, 0, 0, 0, NAIROBI_TZ)
}

/** Calendar days from `from` to `to` (both `yyyy-MM-dd`), positive when `to` is later. */
export function daysBetween(from: string, to: string): number {
  return differenceInCalendarDays(parseDay(to), parseDay(from))
}

/** True when the two dates fall in different Mon-start weeks (Nairobi). */
function isNewWeek(from: string, to: string): boolean {
  const a = startOfWeek(parseDay(from), { weekStartsOn: 1 }).getTime()
  const b = startOfWeek(parseDay(to), { weekStartsOn: 1 }).getTime()
  return a !== b
}

/**
 * Advance the streak because `today` counted (a log or a confirmed no-spend).
 * Idempotent for a day already counted. Applies the once-a-week freeze to
 * forgive a single missed day; a gap of more than one missed day (or no freeze
 * left) resets the streak to 1.
 */
export function countDay(state: StreakState, today: string): StreakState {
  if (state.lastCountedDate === today) return state // already counted today

  const longestFrom = (count: number) => Math.max(state.longestCount, count)

  if (state.lastCountedDate === null) {
    return { currentCount: 1, longestCount: longestFrom(1), lastCountedDate: today, freezesUsedThisWeek: 0 }
  }

  const gap = daysBetween(state.lastCountedDate, today)
  // Reset the weekly freeze allowance when we cross into a new week.
  const freezesUsed = isNewWeek(state.lastCountedDate, today) ? 0 : state.freezesUsedThisWeek

  // Consecutive day → extend.
  if (gap === 1) {
    const next = state.currentCount + 1
    return { currentCount: next, longestCount: longestFrom(next), lastCountedDate: today, freezesUsedThisWeek: freezesUsed }
  }

  // Exactly one missed day, and a freeze is available → forgive, keep going.
  if (gap === 2 && freezesUsed < FREEZES_PER_WEEK) {
    const next = state.currentCount + 1
    return {
      currentCount: next,
      longestCount: longestFrom(next),
      lastCountedDate: today,
      freezesUsedThisWeek: freezesUsed + 1,
    }
  }

  // Broke: too many missed days, or no freeze left → start fresh at 1.
  return { currentCount: 1, longestCount: longestFrom(1), lastCountedDate: today, freezesUsedThisWeek: freezesUsed }
}

export interface StreakView {
  currentCount: number
  /** True when today already counts toward the streak. */
  countedToday: boolean
  /** True when there's a live streak that hasn't been kept today yet. */
  atRisk: boolean
}

/** How the streak should read for `today` given whether today has already counted. */
export function streakView(state: StreakState, today: string): StreakView {
  const countedToday = state.lastCountedDate === today
  return {
    currentCount: state.currentCount,
    countedToday,
    atRisk: !countedToday && state.currentCount > 0,
  }
}
