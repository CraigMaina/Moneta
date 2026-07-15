import { describe, expect, it } from 'vitest'
import fixture from './__fixtures__/sample-statement.txt?raw'
import { parseAmountToCents, parseStatement } from './statementParser'

describe('parseAmountToCents', () => {
  it('parses thousands and cents with integer math', () => {
    expect(parseAmountToCents('1,500.00')).toBe(150000)
    expect(parseAmountToCents('2,340.50')).toBe(234050)
    expect(parseAmountToCents('28.00')).toBe(2800)
    expect(parseAmountToCents('0.05')).toBe(5)
  })
})

describe('parseStatement', () => {
  const result = parseStatement(fixture)

  it('imports only Completed, non-zero rows', () => {
    // 8 data lines: 1 Failed, 1 zero-amount (balance enquiry) → 6 candidates.
    expect(result.candidates).toHaveLength(6)
    expect(result.skippedStatus).toBe(1)
    expect(result.skippedZero).toBe(1)
  })

  it('maps paid-in to income and withdrawn to expense', () => {
    const received = result.candidates.find((c) => c.mpesaRef === 'SGH9ZGHI56')
    expect(received).toMatchObject({ kind: 'income', amountCents: 500000 })

    const kplc = result.candidates.find((c) => c.mpesaRef === 'SGH8YDEF34')
    expect(kplc).toMatchObject({ kind: 'expense', amountCents: 105000 })
  })

  it('uses the receipt as the dedupe ref and keeps the full detail as the note', () => {
    const naivas = result.candidates.find((c) => c.mpesaRef === 'SGI1BMNO90')
    expect(naivas?.merchant).toBe('Naivas Supermarket')
    expect(naivas?.note).toBe('Merchant Payment to Naivas Supermarket')
    expect(naivas?.amountCents).toBe(234050)
  })

  it('strips phone numbers and prefixes for a readable merchant', () => {
    const transfer = result.candidates.find((c) => c.mpesaRef === 'SGH7XABC12')
    expect(transfer?.merchant).toBe('John Doe')
  })

  it('parses the completion time as a Nairobi instant (UTC+3)', () => {
    const first = result.candidates.find((c) => c.mpesaRef === 'SGH7XABC12')
    // 08:12:33 Nairobi = 05:12:33 UTC
    expect(first?.occurredAt).toBe('2026-06-01T05:12:33.000Z')
  })
})
