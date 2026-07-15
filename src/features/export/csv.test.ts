import { describe, expect, it } from 'vitest'
import type { Transaction } from '../transactions/types'
import { centsToDecimalString, escapeCsvField, toCsv, transactionsToCsvRows } from './csv'

describe('centsToDecimalString', () => {
  it('formats cents as a two-decimal string with integer math', () => {
    expect(centsToDecimalString(145_000)).toBe('1450.00')
    expect(centsToDecimalString(5)).toBe('0.05')
    expect(centsToDecimalString(0)).toBe('0.00')
    expect(centsToDecimalString(199)).toBe('1.99')
  })
})

describe('escapeCsvField', () => {
  it('leaves simple fields unquoted', () => {
    expect(escapeCsvField('Rent')).toBe('Rent')
  })

  it('quotes and doubles quotes for fields with commas, quotes, or newlines', () => {
    expect(escapeCsvField('Nairobi, KE')).toBe('"Nairobi, KE"')
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""')
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"')
  })
})

describe('toCsv', () => {
  it('joins rows with CRLF and no trailing newline', () => {
    expect(toCsv([['a', 'b'], ['c', 'd']])).toBe('a,b\r\nc,d')
  })
})

let seq = 0
function txn(partial: Partial<Transaction>): Transaction {
  seq += 1
  return {
    id: `t${seq}`,
    user_id: 'u1',
    account_id: 'acc-mpesa',
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

describe('transactionsToCsvRows', () => {
  const ctx = {
    accountNameById: new Map([
      ['acc-mpesa', 'M-PESA'],
      ['acc-cash', 'Cash'],
    ]),
    categoryNameById: new Map([['cat-food', 'Food & drink']]),
  }

  it('emits a header and resolves account/category names', () => {
    const rows = transactionsToCsvRows(
      [txn({ category_id: 'cat-food', amount_cents: 45_000, merchant: 'Java House' })],
      ctx,
    )
    expect(rows[0]).toEqual([...['Date', 'Kind', 'Amount', 'Currency', 'Account', 'Counter account', 'Category', 'Merchant', 'Note', 'M-PESA ref']])
    expect(rows[1]).toEqual(['2026-07-10', 'expense', '450.00', 'KES', 'M-PESA', '', 'Food & drink', 'Java House', '', ''])
  })

  it('fills the counter account for a transfer', () => {
    const rows = transactionsToCsvRows(
      [txn({ kind: 'transfer', amount_cents: 100_000, counter_account_id: 'acc-cash' })],
      ctx,
    )
    expect(rows[1]?.[4]).toBe('M-PESA')
    expect(rows[1]?.[5]).toBe('Cash')
  })

  it('round-trips cleanly through toCsv with awkward notes', () => {
    const csv = toCsv(transactionsToCsvRows([txn({ note: 'lunch, with "friends"' })], ctx))
    expect(csv).toContain('"lunch, with ""friends"""')
  })
})
