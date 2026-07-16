import { describe, expect, it } from 'vitest'
import { dailySpend, dailyTargetCents, monthlyBudgetCents } from './dailyBudget'

// A fixed instant: 2026-07-16 in Nairobi (July has 31 days).
const JULY = new Date('2026-07-16T09:00:00.000Z')
// 2026-02-10 in Nairobi (Feb 2026 has 28 days).
const FEB = new Date('2026-02-10T09:00:00.000Z')

describe('monthlyBudgetCents', () => {
  it('sums the caps', () => {
    expect(monthlyBudgetCents([{ amount_cents: 1_200_000 }, { amount_cents: 800_000 }])).toBe(2_000_000)
  })

  it('is zero for no budgets', () => {
    expect(monthlyBudgetCents([])).toBe(0)
  })

  it('rejects a non-integer cap', () => {
    expect(() => monthlyBudgetCents([{ amount_cents: 10.5 }])).toThrow(TypeError)
  })
})

describe('dailyTargetCents', () => {
  it('divides the monthly total by the days in the current Nairobi month', () => {
    // 31,000 cents / 31 days = 1,000.
    expect(dailyTargetCents(31_000, JULY)).toBe(1_000)
  })

  it('uses the right day count for a short month', () => {
    // 28,000 / 28 = 1,000 in February.
    expect(dailyTargetCents(28_000, FEB)).toBe(1_000)
  })

  it('floors rather than over-promising a fraction of a cent', () => {
    // 100,000 / 31 = 3225.8… → 3225.
    expect(dailyTargetCents(100_000, JULY)).toBe(3_225)
  })

  it('is zero when there is no budget', () => {
    expect(dailyTargetCents(0, JULY)).toBe(0)
  })
})

describe('dailySpend', () => {
  it('reports what is left today when under target', () => {
    const r = dailySpend(31_000, 600, JULY) // target 1,000
    expect(r.dailyTargetCents).toBe(1_000)
    expect(r.leftTodayCents).toBe(400)
    expect(r.isOver).toBe(false)
    expect(r.hasBudget).toBe(true)
    expect(r.ratio).toBeCloseTo(0.6)
  })

  it('goes negative and flags over once past the target', () => {
    const r = dailySpend(31_000, 1_500, JULY)
    expect(r.leftTodayCents).toBe(-500)
    expect(r.isOver).toBe(true)
    expect(r.ratio).toBe(1) // clamped for the arc
  })

  it('teaches (no budget) rather than showing a 0 target', () => {
    const r = dailySpend(0, 0, JULY)
    expect(r.hasBudget).toBe(false)
    expect(r.isOver).toBe(false)
    expect(r.ratio).toBe(0)
  })
})
