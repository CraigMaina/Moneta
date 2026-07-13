import { describe, expect, it } from 'vitest'
import { addTransactionSchema, updateTransactionSchema } from './schemas'

const mpesaId = '11111111-1111-4111-8111-111111111111'
const cashId = '22222222-2222-4222-8222-222222222222'
const categoryId = '33333333-3333-4333-8333-333333333333'

describe('addTransactionSchema', () => {
  it('accepts a valid expense', () => {
    const result = addTransactionSchema.safeParse({
      kind: 'expense',
      amount_cents: 15000,
      account_id: mpesaId,
      category_id: categoryId,
    })
    expect(result.success).toBe(true)
  })

  it('accepts a valid income', () => {
    const result = addTransactionSchema.safeParse({
      kind: 'income',
      amount_cents: 250000,
      account_id: mpesaId,
    })
    expect(result.success).toBe(true)
  })

  it('accepts a valid transfer with a distinct counter_account_id and no category', () => {
    const result = addTransactionSchema.safeParse({
      kind: 'transfer',
      amount_cents: 50000,
      account_id: mpesaId,
      counter_account_id: cashId,
    })
    expect(result.success).toBe(true)
  })

  it('rejects a float amount_cents — never floats for money', () => {
    const result = addTransactionSchema.safeParse({
      kind: 'expense',
      amount_cents: 150.5,
      account_id: mpesaId,
    })
    expect(result.success).toBe(false)
  })

  it('rejects a zero or negative amount_cents', () => {
    expect(addTransactionSchema.safeParse({ kind: 'expense', amount_cents: 0, account_id: mpesaId }).success).toBe(
      false,
    )
    expect(addTransactionSchema.safeParse({ kind: 'expense', amount_cents: -500, account_id: mpesaId }).success).toBe(
      false,
    )
  })

  it('rejects a transfer with no counter_account_id', () => {
    const result = addTransactionSchema.safeParse({
      kind: 'transfer',
      amount_cents: 50000,
      account_id: mpesaId,
    })
    expect(result.success).toBe(false)
  })

  it('rejects a transfer whose counter_account_id equals account_id', () => {
    const result = addTransactionSchema.safeParse({
      kind: 'transfer',
      amount_cents: 50000,
      account_id: mpesaId,
      counter_account_id: mpesaId,
    })
    expect(result.success).toBe(false)
  })

  it('rejects a transfer with a category_id', () => {
    const result = addTransactionSchema.safeParse({
      kind: 'transfer',
      amount_cents: 50000,
      account_id: mpesaId,
      counter_account_id: cashId,
      category_id: categoryId,
    })
    expect(result.success).toBe(false)
  })

  it('rejects a non-transfer that sets counter_account_id', () => {
    const result = addTransactionSchema.safeParse({
      kind: 'expense',
      amount_cents: 50000,
      account_id: mpesaId,
      counter_account_id: cashId,
    })
    expect(result.success).toBe(false)
  })

  it('rejects a non-uuid account_id', () => {
    const result = addTransactionSchema.safeParse({
      kind: 'expense',
      amount_cents: 5000,
      account_id: 'not-a-uuid',
    })
    expect(result.success).toBe(false)
  })

  it('rejects an invalid occurred_at string', () => {
    const result = addTransactionSchema.safeParse({
      kind: 'expense',
      amount_cents: 5000,
      account_id: mpesaId,
      occurred_at: 'not-a-date',
    })
    expect(result.success).toBe(false)
  })
})

describe('updateTransactionSchema', () => {
  it('accepts an empty patch', () => {
    expect(updateTransactionSchema.safeParse({}).success).toBe(true)
  })

  it('accepts a partial patch touching only note', () => {
    expect(updateTransactionSchema.safeParse({ note: 'Split with Wanjiru' }).success).toBe(true)
  })

  it('rejects a float amount_cents in a patch', () => {
    expect(updateTransactionSchema.safeParse({ amount_cents: 99.9 }).success).toBe(false)
  })

  it('rejects changing kind to transfer without also patching counter_account_id', () => {
    const result = updateTransactionSchema.safeParse({ kind: 'transfer' })
    expect(result.success).toBe(false)
  })

  it('accepts changing kind to transfer together with a valid counter_account_id', () => {
    const result = updateTransactionSchema.safeParse({
      kind: 'transfer',
      account_id: mpesaId,
      counter_account_id: cashId,
    })
    expect(result.success).toBe(true)
  })
})
