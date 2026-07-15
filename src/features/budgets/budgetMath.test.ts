import { describe, expect, it } from 'vitest'
import type { CategorySlice } from '../insights/insightsMath'
import { budgetProgress, capForPeriod } from './budgetMath'
import type { Budget } from './types'

let seq = 0
function budget(categoryId: string, amountCents: number): Budget {
  seq += 1
  return {
    id: `b${seq}`,
    user_id: 'u1',
    category_id: categoryId,
    amount_cents: amountCents,
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
  }
}

describe('capForPeriod', () => {
  it('returns the monthly cap unchanged for month grain', () => {
    expect(capForPeriod(15_000_00, 'month')).toBe(15_000_00)
  })

  it('scales a monthly cap down to a week (× 12/52), rounded to integer cents', () => {
    // 15,000 × 12/52 = 3,461.538… → 346154 cents
    expect(capForPeriod(15_000_00, 'week')).toBe(346154)
  })
})

describe('budgetProgress', () => {
  const budgets = [budget('food', 15_000_00), budget('transport', 8_000_00), budget('shopping', 6_000_00)]
  const spend: CategorySlice[] = [
    { categoryId: 'food', amountCents: 11_200_00 },
    { categoryId: 'transport', amountCents: 3_400_00 },
    { categoryId: 'shopping', amountCents: 6_500_00 }, // over
    { categoryId: null, amountCents: 900_00 }, // uncategorized — ignored
  ]

  it('joins spend to caps and flags over/near states (monthly)', () => {
    const rows = budgetProgress(budgets, spend, 'month')
    const byId = Object.fromEntries(rows.map((r) => [r.categoryId, r]))

    expect(byId.food).toMatchObject({ capCents: 15_000_00, spentCents: 11_200_00, over: false, nearing: false })
    expect(byId.transport).toMatchObject({ spentCents: 3_400_00, over: false, nearing: false })
    expect(byId.shopping).toMatchObject({ spentCents: 6_500_00, over: true, remainingCents: -500_00 })
  })

  it('marks the 80%+ (but not over) band as nearing', () => {
    const rows = budgetProgress([budget('food', 10_000_00)], [{ categoryId: 'food', amountCents: 8_500_00 }], 'month')
    expect(rows[0]).toMatchObject({ nearing: true, over: false })
  })

  it('sorts most-at-risk first (highest spend ratio)', () => {
    const rows = budgetProgress(budgets, spend, 'month')
    expect(rows[0]?.categoryId).toBe('shopping') // 108%
    expect(rows[1]?.categoryId).toBe('food') // 75%
    expect(rows[2]?.categoryId).toBe('transport') // 42%
  })

  it('shows a budgeted category with no spend as zero, never dropping it', () => {
    const rows = budgetProgress([budget('rent', 30_000_00)], [], 'month')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ spentCents: 0, ratio: 0, over: false })
  })

  it('applies the weekly cap slice under week grain', () => {
    const rows = budgetProgress([budget('food', 15_000_00)], [{ categoryId: 'food', amountCents: 3_000_00 }], 'week')
    expect(rows[0]?.capCents).toBe(346154)
    expect(rows[0]?.over).toBe(false)
  })
})
