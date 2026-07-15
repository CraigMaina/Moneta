import { describe, expect, it } from 'vitest'
import type { Transaction } from '../transactions/types'
import { computeNudges, type NudgeInputs } from './nudgeRules'

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

// A fixed "now" mid-month so pace math has room and the month is ~1/3 elapsed.
const NOW = new Date('2026-07-10T09:00:00.000Z') // 10 July, Nairobi day 10 of 31

function inputs(transactions: Transaction[], overrides: Partial<NudgeInputs> = {}): NudgeInputs {
  return {
    transactions,
    categoryNameById: new Map([['food', 'Food & drink']]),
    recurringMerchants: new Set<string>(),
    now: NOW,
    ...overrides,
  }
}

describe('category-pace nudges', () => {
  it('flags a category already past 80% of its usual monthly spend early in the month', () => {
    const txns: Transaction[] = [
      // Baseline: ~KES 3,000/mo on Food across Apr/May/Jun (usualMonthly ≈ 300,000 cents).
      txn({ category_id: 'food', amount_cents: 300_000, occurred_at: '2026-04-15T09:00:00.000Z' }),
      txn({ category_id: 'food', amount_cents: 300_000, occurred_at: '2026-05-15T09:00:00.000Z' }),
      txn({ category_id: 'food', amount_cents: 300_000, occurred_at: '2026-06-15T09:00:00.000Z' }),
      // This month, only the 10th, already KES 2,800 — ~93% of usual, well ahead of ~32% elapsed.
      txn({ category_id: 'food', amount_cents: 280_000, occurred_at: '2026-07-05T09:00:00.000Z' }),
    ]
    const nudges = computeNudges(inputs(txns))
    const pace = nudges.find((n) => n.kind === 'category-pace')
    expect(pace).toBeDefined()
    expect(pace?.tone).toBe('warning')
    expect(pace?.body).toContain('Food & drink')
    expect(pace?.signature).toBe('pace:food:2026-07')
  })

  it('does not flag when spend is in line with the month elapsed', () => {
    const txns: Transaction[] = [
      txn({ category_id: 'food', amount_cents: 300_000, occurred_at: '2026-04-15T09:00:00.000Z' }),
      txn({ category_id: 'food', amount_cents: 300_000, occurred_at: '2026-05-15T09:00:00.000Z' }),
      txn({ category_id: 'food', amount_cents: 300_000, occurred_at: '2026-06-15T09:00:00.000Z' }),
      // ~KES 500 by the 10th (~17%), below the elapsed share → no nudge.
      txn({ category_id: 'food', amount_cents: 50_000, occurred_at: '2026-07-05T09:00:00.000Z' }),
    ]
    expect(computeNudges(inputs(txns)).some((n) => n.kind === 'category-pace')).toBe(false)
  })

  it('ignores trivial categories below the baseline floor', () => {
    const txns: Transaction[] = [
      // Usual ≈ KES 500/mo — under the KES 2,000 floor, so never a pace nudge.
      txn({ category_id: 'food', amount_cents: 50_000, occurred_at: '2026-05-15T09:00:00.000Z' }),
      txn({ category_id: 'food', amount_cents: 100_000, occurred_at: '2026-06-15T09:00:00.000Z' }),
      txn({ category_id: 'food', amount_cents: 90_000, occurred_at: '2026-07-05T09:00:00.000Z' }),
    ]
    expect(computeNudges(inputs(txns)).some((n) => n.kind === 'category-pace')).toBe(false)
  })
})

describe('subscription nudges', () => {
  it('suggests tracking a repeated similar monthly charge', () => {
    const txns: Transaction[] = [
      txn({ merchant: 'Netflix', amount_cents: 110_000, occurred_at: '2026-05-08T09:00:00.000Z' }),
      txn({ merchant: 'Netflix', amount_cents: 110_000, occurred_at: '2026-06-08T09:00:00.000Z' }),
    ]
    const sub = computeNudges(inputs(txns)).find((n) => n.kind === 'subscription')
    expect(sub).toBeDefined()
    expect(sub?.action).toEqual({ kind: 'add-recurring', merchant: 'Netflix', amountCents: 110_000, categoryId: null })
    expect(sub?.signature).toBe('sub:netflix')
  })

  it('does not suggest a merchant already tracked as a recurring bill', () => {
    const txns: Transaction[] = [
      txn({ merchant: 'Netflix', amount_cents: 110_000, occurred_at: '2026-05-08T09:00:00.000Z' }),
      txn({ merchant: 'Netflix', amount_cents: 110_000, occurred_at: '2026-06-08T09:00:00.000Z' }),
    ]
    const nudges = computeNudges(inputs(txns, { recurringMerchants: new Set(['netflix']) }))
    expect(nudges.some((n) => n.kind === 'subscription')).toBe(false)
  })

  it('ignores charges that vary too much in amount', () => {
    const txns: Transaction[] = [
      txn({ merchant: 'Shop', amount_cents: 50_000, occurred_at: '2026-05-08T09:00:00.000Z' }),
      txn({ merchant: 'Shop', amount_cents: 400_000, occurred_at: '2026-06-08T09:00:00.000Z' }),
    ]
    expect(computeNudges(inputs(txns)).some((n) => n.kind === 'subscription')).toBe(false)
  })

  it('ignores two charges bunched inside the same week', () => {
    const txns: Transaction[] = [
      txn({ merchant: 'Shop', amount_cents: 110_000, occurred_at: '2026-06-04T09:00:00.000Z' }),
      txn({ merchant: 'Shop', amount_cents: 110_000, occurred_at: '2026-06-08T09:00:00.000Z' }),
    ]
    expect(computeNudges(inputs(txns)).some((n) => n.kind === 'subscription')).toBe(false)
  })
})

describe('unusual-spend nudges', () => {
  it('flags a recent expense far larger than the category typical', () => {
    const history: Transaction[] = Array.from({ length: 5 }, (_, i) =>
      txn({ category_id: 'food', amount_cents: 50_000, occurred_at: `2026-06-${String(10 + i).padStart(2, '0')}T09:00:00.000Z` }),
    )
    const spike = txn({
      id: 'spike',
      category_id: 'food',
      merchant: 'Big Store',
      amount_cents: 400_000, // 8× the KES 500 typical, above the KES 3,000 floor
      occurred_at: '2026-07-09T09:00:00.000Z',
    })
    const nudge = computeNudges(inputs([...history, spike])).find((n) => n.kind === 'unusual-spend')
    expect(nudge).toBeDefined()
    expect(nudge?.signature).toBe('unusual:spike')
    expect(nudge?.body).toContain('Big Store')
  })

  it('does not flag without enough history to judge "usual"', () => {
    const txns: Transaction[] = [
      txn({ category_id: 'food', amount_cents: 50_000, occurred_at: '2026-06-10T09:00:00.000Z' }),
      txn({ category_id: 'food', amount_cents: 400_000, occurred_at: '2026-07-09T09:00:00.000Z' }),
    ]
    expect(computeNudges(inputs(txns)).some((n) => n.kind === 'unusual-spend')).toBe(false)
  })

  it('does not flag a large-but-typical expense', () => {
    const history: Transaction[] = Array.from({ length: 5 }, (_, i) =>
      txn({ category_id: 'rent', amount_cents: 500_000, occurred_at: `2026-06-${String(10 + i).padStart(2, '0')}T09:00:00.000Z` }),
    )
    const normal = txn({ category_id: 'rent', amount_cents: 520_000, occurred_at: '2026-07-09T09:00:00.000Z' })
    expect(computeNudges(inputs([...history, normal])).some((n) => n.kind === 'unusual-spend')).toBe(false)
  })
})
