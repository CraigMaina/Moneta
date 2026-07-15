import { describe, expect, it } from 'vitest'
import type { Transaction } from '../transactions/types'
import {
  OTHER_SLICE_ID,
  monthInsights,
  monthKeyLabel,
  monthKeyShortLabel,
  monthlySeries,
  nairobiMonthKey,
  recentMonthKeys,
  withOtherBucket,
} from './insightsMath'

let seq = 0
function txn(partial: Partial<Transaction>): Transaction {
  seq += 1
  return {
    id: `t${seq}`,
    user_id: 'u1',
    account_id: 'a1',
    counter_account_id: null,
    category_id: null,
    kind: 'expense',
    amount_cents: 0,
    merchant: null,
    note: null,
    occurred_at: '2026-07-10T09:00:00.000Z',
    source: 'manual',
    mpesa_ref: null,
    fee_cents: null,
    raw_sms: null,
    parser_version: null,
    created_at: '2026-07-10T09:00:00.000Z',
    ...partial,
  }
}

describe('nairobiMonthKey', () => {
  it('buckets by the Nairobi calendar month, not UTC', () => {
    // 2026-06-30 22:30 UTC is 2026-07-01 01:30 in Nairobi (UTC+3) → July.
    expect(nairobiMonthKey('2026-06-30T22:30:00.000Z')).toBe('2026-07')
    expect(nairobiMonthKey('2026-07-10T09:00:00.000Z')).toBe('2026-07')
  })
})

describe('recentMonthKeys', () => {
  it('returns N months oldest-first, including the current one', () => {
    expect(recentMonthKeys(new Date('2026-07-15T09:00:00.000Z'), 3)).toEqual(['2026-05', '2026-06', '2026-07'])
  })

  it('crosses the year boundary correctly', () => {
    expect(recentMonthKeys(new Date('2026-01-15T09:00:00.000Z'), 3)).toEqual(['2025-11', '2025-12', '2026-01'])
  })
})

describe('monthInsights', () => {
  const txns = [
    txn({ kind: 'income', amount_cents: 50_000_00, occurred_at: '2026-07-01T06:00:00.000Z' }),
    txn({ kind: 'expense', amount_cents: 1_200_00, category_id: 'food', occurred_at: '2026-07-05T06:00:00.000Z' }),
    txn({ kind: 'expense', amount_cents: 800_00, category_id: 'food', occurred_at: '2026-07-06T06:00:00.000Z' }),
    txn({ kind: 'expense', amount_cents: 3_000_00, category_id: 'rent', occurred_at: '2026-07-02T06:00:00.000Z' }),
    txn({ kind: 'expense', amount_cents: 340_00, category_id: 'fees', occurred_at: '2026-07-07T06:00:00.000Z' }),
    txn({ kind: 'expense', amount_cents: 150_00, category_id: null, occurred_at: '2026-07-08T06:00:00.000Z' }),
    // A transfer — must be ignored entirely.
    txn({ kind: 'transfer', amount_cents: 9_999_00, counter_account_id: 'a2', occurred_at: '2026-07-03T06:00:00.000Z' }),
    // Another month — must not leak in.
    txn({ kind: 'expense', amount_cents: 700_00, category_id: 'food', occurred_at: '2026-06-20T06:00:00.000Z' }),
  ]

  const result = monthInsights(txns, '2026-07', { feeCategoryId: 'fees' })

  it('sums income and expense, excluding transfers and other months', () => {
    expect(result.incomeCents).toBe(50_000_00)
    expect(result.expenseCents).toBe(1_200_00 + 800_00 + 3_000_00 + 340_00 + 150_00)
    expect(result.netCents).toBe(result.incomeCents - result.expenseCents)
    expect(result.expenseCount).toBe(5)
  })

  it('breaks expenses down by category, largest first, with a null bucket', () => {
    expect(result.byCategory).toEqual([
      { categoryId: 'rent', amountCents: 3_000_00 },
      { categoryId: 'food', amountCents: 2_000_00 },
      { categoryId: 'fees', amountCents: 340_00 },
      { categoryId: null, amountCents: 150_00 },
    ])
  })

  it('totals the fee category for the spotlight', () => {
    expect(result.feesCents).toBe(340_00)
    expect(monthInsights(txns, '2026-07').feesCents).toBe(0) // no fee id → 0
  })

  it('is all zeros for a month with no activity', () => {
    const empty = monthInsights(txns, '2026-01', { feeCategoryId: 'fees' })
    expect(empty).toMatchObject({ incomeCents: 0, expenseCents: 0, netCents: 0, feesCents: 0, byCategory: [], expenseCount: 0 })
  })
})

describe('monthlySeries', () => {
  it('produces in/out per month in order, zero-filling empty months', () => {
    const txns = [
      txn({ kind: 'income', amount_cents: 1000, occurred_at: '2026-05-10T06:00:00.000Z' }),
      txn({ kind: 'expense', amount_cents: 400, occurred_at: '2026-07-10T06:00:00.000Z' }),
      txn({ kind: 'transfer', amount_cents: 9999, counter_account_id: 'a2', occurred_at: '2026-07-11T06:00:00.000Z' }),
    ]
    expect(monthlySeries(txns, ['2026-05', '2026-06', '2026-07'])).toEqual([
      { monthKey: '2026-05', incomeCents: 1000, expenseCents: 0 },
      { monthKey: '2026-06', incomeCents: 0, expenseCents: 0 },
      { monthKey: '2026-07', incomeCents: 0, expenseCents: 400 },
    ])
  })
})

describe('withOtherBucket', () => {
  const slices = [
    { categoryId: 'a', amountCents: 500 },
    { categoryId: 'b', amountCents: 400 },
    { categoryId: 'c', amountCents: 300 },
    { categoryId: 'd', amountCents: 200 },
    { categoryId: 'e', amountCents: 100 },
  ]

  it('folds the tail into a single Other bucket', () => {
    expect(withOtherBucket(slices, 3)).toEqual([
      { categoryId: 'a', amountCents: 500 },
      { categoryId: 'b', amountCents: 400 },
      { categoryId: OTHER_SLICE_ID, amountCents: 600 },
    ])
  })

  it('leaves short lists untouched', () => {
    expect(withOtherBucket(slices.slice(0, 2), 3)).toEqual(slices.slice(0, 2))
  })
})

describe('month labels', () => {
  it('formats long and short month labels', () => {
    expect(monthKeyLabel('2026-07')).toBe('July 2026')
    expect(monthKeyShortLabel('2026-07')).toBe('Jul')
  })
})
