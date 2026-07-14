import { describe, expect, it } from 'vitest'
import { groupTransactionsByNairobiDay, relativeNairobiDayLabel } from './transactionGroups'
import type { Transaction } from './types'

function makeTxn(overrides: Partial<Transaction> & Pick<Transaction, 'id' | 'occurred_at'>): Transaction {
  return {
    user_id: 'user-1',
    account_id: 'acct-1',
    counter_account_id: null,
    category_id: null,
    amount_cents: 1000,
    kind: 'expense',
    merchant: null,
    note: null,
    mpesa_ref: null,
    fee_cents: null,
    parser_version: null,
    raw_sms: null,
    source: 'manual',
    created_at: overrides.occurred_at,
    ...overrides,
  }
}

describe('relativeNairobiDayLabel', () => {
  it('labels the current Nairobi day "Today"', () => {
    const now = new Date('2026-07-13T08:00:00.000Z') // 11:00 Nairobi
    expect(relativeNairobiDayLabel('2026-07-13', now)).toBe('Today')
  })

  it('labels the previous Nairobi day "Yesterday"', () => {
    const now = new Date('2026-07-13T08:00:00.000Z')
    expect(relativeNairobiDayLabel('2026-07-12', now)).toBe('Yesterday')
  })

  it('formats older days as a short weekday-date', () => {
    const now = new Date('2026-07-13T08:00:00.000Z')
    expect(relativeNairobiDayLabel('2026-07-01', now)).toBe('Wed 1 Jul')
  })
})

describe('groupTransactionsByNairobiDay', () => {
  const now = new Date('2026-07-13T08:00:00.000Z')

  it('groups rows under the correct Nairobi day, newest day first', () => {
    const today = makeTxn({ id: 't-today', occurred_at: '2026-07-13T09:00:00.000Z' })
    const yesterday = makeTxn({ id: 't-yesterday', occurred_at: '2026-07-12T09:00:00.000Z' })

    const groups = groupTransactionsByNairobiDay([today, yesterday], now)

    expect(groups).toHaveLength(2)
    expect(groups[0]).toMatchObject({ dayKey: '2026-07-13', label: 'Today' })
    expect(groups[0]?.transactions).toEqual([today])
    expect(groups[1]).toMatchObject({ dayKey: '2026-07-12', label: 'Yesterday' })
    expect(groups[1]?.transactions).toEqual([yesterday])
  })

  it('keeps multiple same-day rows in one group, in input order', () => {
    const first = makeTxn({ id: 't-1', occurred_at: '2026-07-13T09:00:00.000Z' })
    const second = makeTxn({ id: 't-2', occurred_at: '2026-07-13T07:00:00.000Z' })

    const groups = groupTransactionsByNairobiDay([first, second], now)

    expect(groups).toHaveLength(1)
    expect(groups[0]?.transactions).toEqual([first, second])
  })

  it('assigns the Nairobi calendar day even when it differs from the UTC day (device-tz independent)', () => {
    // 22:30 UTC on the 13th is 01:30 Nairobi (UTC+3) on the 14th — the group
    // must land on the 14th regardless of what timezone the test runner's
    // host machine/device is in, since Nairobi is computed explicitly via
    // TZDate, never the device's local zone.
    const lateUtc = makeTxn({ id: 't-late', occurred_at: '2026-07-13T22:30:00.000Z' })
    const nowNextDay = new Date('2026-07-14T05:00:00.000Z') // 08:00 Nairobi on the 14th

    const groups = groupTransactionsByNairobiDay([lateUtc], nowNextDay)

    expect(groups[0]?.dayKey).toBe('2026-07-14')
    expect(groups[0]?.label).toBe('Today')
  })

  it('returns no groups for an empty list', () => {
    expect(groupTransactionsByNairobiDay([], now)).toEqual([])
  })
})
