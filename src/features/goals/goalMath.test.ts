import { describe, expect, it } from 'vitest'
import type { GoalContribution } from './types'
import { goalProgressFraction, goalSavedCents, isGoalReached, projectGoalCompletion } from './goalMath'

const contrib = (amount_cents: number, occurred_at: string): Pick<GoalContribution, 'amount_cents' | 'occurred_at'> => ({
  amount_cents,
  occurred_at,
})

describe('goalSavedCents', () => {
  it('sums contributions', () => {
    expect(goalSavedCents([{ amount_cents: 500 }, { amount_cents: 1500 }])).toBe(2000)
    expect(goalSavedCents([])).toBe(0)
  })
})

describe('goalProgressFraction', () => {
  it('is the saved/target ratio, clamped to 0–1', () => {
    expect(goalProgressFraction(2500, 10000)).toBe(0.25)
    expect(goalProgressFraction(12000, 10000)).toBe(1)
    expect(goalProgressFraction(0, 10000)).toBe(0)
  })
  it('treats a zero target as complete (no divide-by-zero)', () => {
    expect(goalProgressFraction(0, 0)).toBe(1)
  })
})

describe('isGoalReached', () => {
  it('is true once saved meets or exceeds target', () => {
    expect(isGoalReached(9999, 10000)).toBe(false)
    expect(isGoalReached(10000, 10000)).toBe(true)
    expect(isGoalReached(10001, 10000)).toBe(true)
  })
})

describe('projectGoalCompletion', () => {
  const now = new Date('2026-07-15T12:00:00.000Z')

  it('reports reached when already funded', () => {
    expect(projectGoalCompletion(10000, 10000, [], now)).toEqual({ status: 'reached', date: null, daysRemaining: null })
  })

  it('reports no-rate when nothing was contributed in the last 30 days', () => {
    const old = contrib(5000, '2026-05-01T12:00:00.000Z') // > 30 days ago
    expect(projectGoalCompletion(5000, 10000, [old], now)).toEqual({ status: 'no-rate', date: null, daysRemaining: null })
  })

  it('projects a date from the trailing-30-day rate', () => {
    // 3000 cents contributed in-window → 100 cents/day. Remaining 5000 → 50 days.
    const recent = [contrib(3000, '2026-07-10T12:00:00.000Z')]
    const projection = projectGoalCompletion(5000, 10000, recent, now)
    expect(projection.status).toBe('projected')
    expect(projection.daysRemaining).toBe(50)
    expect(projection.date).toEqual(new Date('2026-09-03T12:00:00.000Z'))
  })

  it('excludes contributions older than the 30-day window from the rate', () => {
    const mixed = [contrib(3000, '2026-07-10T12:00:00.000Z'), contrib(9000, '2026-01-01T12:00:00.000Z')]
    // Only the in-window 3000 counts → same 100/day, 50 days.
    expect(projectGoalCompletion(5000, 10000, mixed, now).daysRemaining).toBe(50)
  })
})
