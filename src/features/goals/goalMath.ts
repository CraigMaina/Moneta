import type { GoalContribution } from './types'

/**
 * Pure savings-goal math (PRD F7 / §4.4). Integer cents throughout; a goal's
 * saved amount is DERIVED from its contributions, never stored (CLAUDE.md:
 * balances are derived). No I/O, no formatting — exhaustively unit-tested.
 */

const DAY_MS = 24 * 60 * 60 * 1000
const RATE_WINDOW_DAYS = 30

/** Total saved toward a goal = sum of its contributions (always ≥ 0). */
export function goalSavedCents(contributions: Pick<GoalContribution, 'amount_cents'>[]): number {
  return contributions.reduce((sum, c) => sum + c.amount_cents, 0)
}

/** Progress as a 0–1 fraction, clamped; a 0-target goal reads as complete. */
export function goalProgressFraction(savedCents: number, targetCents: number): number {
  if (targetCents <= 0) return 1
  return Math.min(1, Math.max(0, savedCents / targetCents))
}

export function isGoalReached(savedCents: number, targetCents: number): boolean {
  return savedCents >= targetCents
}

export type ProjectionStatus = 'reached' | 'no-rate' | 'projected'

export interface GoalProjection {
  status: ProjectionStatus
  /** Estimated completion date; null unless `status === 'projected'`. */
  date: Date | null
  /** Whole days remaining at the current rate; null unless projected. */
  daysRemaining: number | null
}

/**
 * Projected completion from the trailing-30-day contribution rate (PRD F7:
 * "projected date recalculates from a trailing 30-day contribution rate").
 * `reached` when already funded; `no-rate` when nothing was contributed in the
 * last 30 days (we can't honestly project); otherwise a date `remaining / rate`
 * days out.
 */
export function projectGoalCompletion(
  savedCents: number,
  targetCents: number,
  contributions: Pick<GoalContribution, 'amount_cents' | 'occurred_at'>[],
  now: Date = new Date(),
): GoalProjection {
  const remaining = targetCents - savedCents
  if (remaining <= 0) return { status: 'reached', date: null, daysRemaining: null }

  const windowStart = now.getTime() - RATE_WINDOW_DAYS * DAY_MS
  const recentCents = contributions.reduce(
    (sum, c) => (new Date(c.occurred_at).getTime() >= windowStart ? sum + c.amount_cents : sum),
    0,
  )
  const centsPerDay = recentCents / RATE_WINDOW_DAYS
  if (centsPerDay <= 0) return { status: 'no-rate', date: null, daysRemaining: null }

  const daysRemaining = Math.ceil(remaining / centsPerDay)
  return {
    status: 'projected',
    date: new Date(now.getTime() + daysRemaining * DAY_MS),
    daysRemaining,
  }
}
