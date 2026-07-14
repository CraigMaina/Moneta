import { describe, expect, it } from 'vitest'
import { parseMpesaMessage } from './index'

/**
 * Money-correctness semantics that CLAUDE.md calls out explicitly:
 *  - withdrawal = transfer + separate fee expense, never a single expense
 *  - deposit = transfer, no fee
 *  - reversal negates its original by ref, never books as plain income/expense
 *  - dedupe by mpesa_ref: re-parsing the same message is a no-op (the parser
 *    is pure/stateless, so "no-op" here means deterministic, identical
 *    output — the DB's unique index on mpesa_ref does the actual no-op).
 */

describe('withdrawal semantics', () => {
  const raw =
    'WDL9ZZZZZ1 Confirmed. You have withdrawn Ksh2,000.00 from agent 123456 - JOHN AGENT SHOP on 11/7/26 at 11:00 AM. New M-PESA balance is Ksh500.00. Transaction cost, Ksh28.00.'

  it('is a transfer (never a single expense), M-PESA -> Cash, with the fee carried separately', () => {
    const result = parseMpesaMessage(raw)
    expect(result.status).toBe('matched')
    if (result.status !== 'matched') return

    expect(result.data.kind).toBe('transfer')
    expect(result.data.counterAccountHint).toBe('cash')
    expect(result.data.transferDirection).toBe('mpesa_to_counter')
    expect(result.data.category).toBeNull()
    expect(result.data.amountCents).toBe(200000)
    expect(result.data.feeCents).toBe(2800)
    // The integrator is expected to book TWO rows from this one result:
    // a transfer of amountCents, and a separate "Fees & Fuliza charges"
    // expense of feeCents — never amountCents + feeCents as one expense.
  })
})

describe('deposit semantics', () => {
  it('is a transfer, Cash -> M-PESA, and carries no fee', () => {
    const raw =
      'DEP9ZZZZZ1 Confirmed. You have deposited Ksh5,000.00 to your M-PESA account from agent 123456 - JOHN AGENT SHOP on 9/7/26 at 10:15 AM. New M-PESA balance is Ksh5,500.00.'
    const result = parseMpesaMessage(raw)
    expect(result.status).toBe('matched')
    if (result.status !== 'matched') return

    expect(result.data.kind).toBe('transfer')
    expect(result.data.counterAccountHint).toBe('cash')
    expect(result.data.transferDirection).toBe('counter_to_mpesa')
    expect(result.data.category).toBeNull()
    expect(result.data.feeCents).toBe(0)
  })
})

describe('Fuliza semantics', () => {
  it('drawdown is never income — kind is transfer, money flows into M-PESA', () => {
    const raw =
      'FLZ9ZZZZZ1 Confirmed. You have used Fuliza M-PESA. Amount used Ksh500.00 on 20/7/26 at 8:20 PM. Access fee charged Ksh10.00. Total Fuliza M-PESA outstanding is Ksh510.00. New M-PESA balance is Ksh0.00.'
    const result = parseMpesaMessage(raw)
    expect(result.status).toBe('matched')
    if (result.status !== 'matched') return

    expect(result.data.kind).not.toBe('income')
    expect(result.data.kind).toBe('transfer')
    expect(result.data.transferDirection).toBe('counter_to_mpesa')
    expect(result.data.feeCents).toBe(1000) // the access fee — a separate Fees & Fuliza charges expense for the integrator
  })

  it('repayment is a transfer, money flows out of M-PESA to pay down the loan', () => {
    const raw =
      'FLR9ZZZZZ1 Confirmed. Ksh300.00 from your M-PESA has been used to pay your outstanding Fuliza M-PESA on 26/7/26 at 9:30 AM. New Fuliza M-PESA outstanding amount is Ksh0.00. New M-PESA balance is Ksh200.00.'
    const result = parseMpesaMessage(raw)
    expect(result.status).toBe('matched')
    if (result.status !== 'matched') return

    expect(result.data.kind).toBe('transfer')
    expect(result.data.transferDirection).toBe('mpesa_to_counter')
  })
})

describe('reversal semantics', () => {
  it('carries reversalOfRef pointing at the ORIGINAL transaction, and is never booked as plain income/expense', () => {
    const raw =
      'REV9ZZZZZ1 Confirmed. The reversal of Ksh500.00 for transaction QGH7XXXXX1 on 7/6/26 at 1:10 PM is complete. New M-PESA balance is Ksh1,500.00.'
    const result = parseMpesaMessage(raw)
    expect(result.status).toBe('matched')
    if (result.status !== 'matched') return

    expect(result.data.family).toBe('reversal')
    expect(result.data.reversalOfRef).toBe('QGH7XXXXX1')
    expect(result.data.kind).toBe('transfer') // safety marker only — see types.ts doc comment
    expect(result.data.category).toBeNull()
    // The reversal's OWN ref stays distinct from the original's ref, so the
    // integrator can still dedupe re-parses of this reversal SMS itself.
    expect(result.data.mpesaRef).toBe('REV9ZZZZZ1')
    expect(result.data.mpesaRef).not.toBe(result.data.reversalOfRef)
  })
})

describe('dedupe idempotency', () => {
  it('parsing the identical message twice yields deep-equal output (deterministic, no hidden state)', () => {
    const raw =
      'QGH7XXXXX1 Confirmed. You have received Ksh1,500.00 from JOHN KAMAU 0722123456 on 5/7/26 at 2:45 PM. New M-PESA balance is Ksh3,200.00.'
    const first = parseMpesaMessage(raw)
    const second = parseMpesaMessage(raw)
    expect(first).toEqual(second)
    expect(first.status).toBe('matched')
    if (first.status === 'matched' && second.status === 'matched') {
      // The mpesa_ref stays fixed across re-parses — this is exactly what
      // lets the DB's unique-per-user index on mpesa_ref turn a re-paste
      // into a silent no-op.
      expect(first.data.mpesaRef).toBe(second.data.mpesaRef)
    }
  })
})
