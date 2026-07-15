import { describe, expect, it } from 'vitest'
import fixture from './__fixtures__/sample-statement.txt?raw'
import signedFixture from './__fixtures__/sample-statement-signed.txt?raw'
import { parseAmountToCents, parseStatement } from './statementParser'

describe('parseAmountToCents', () => {
  it('parses thousands and cents with integer math', () => {
    expect(parseAmountToCents('1,500.00')).toBe(150000)
    expect(parseAmountToCents('2,340.50')).toBe(234050)
    expect(parseAmountToCents('28.00')).toBe(2800)
    expect(parseAmountToCents('0.05')).toBe(5)
  })

  it('preserves the sign, including cents, for negative amounts', () => {
    expect(parseAmountToCents('-235.00')).toBe(-23500)
    expect(parseAmountToCents('-3,115.56')).toBe(-311556)
    expect(parseAmountToCents('-7.50')).toBe(-750)
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

  it('tolerates uppercase status and a missing seconds field', () => {
    const line = 'QAB1CD2EF3 2026-07-01 09:30 Merchant Payment to Carrefour COMPLETED 0.00 899.00 1,200.00'
    const { candidates } = parseStatement(line)
    expect(candidates).toHaveLength(1)
    expect(candidates[0]).toMatchObject({ kind: 'expense', amountCents: 89900, merchant: 'Carrefour' })
    // 09:30:00 Nairobi = 06:30:00 UTC
    expect(candidates[0]?.occurredAt).toBe('2026-07-01T06:30:00.000Z')
  })
})

describe('parseStatement — real signed-amount format', () => {
  const result = parseStatement(signedFixture)
  const byRef = (ref: string) => result.candidates.find((c) => c.mpesaRef === ref)

  it('imports every Completed, non-zero row and skips the Failed one', () => {
    expect(result.candidates).toHaveLength(8)
    expect(result.skippedStatus).toBe(1)
    expect(result.skippedZero).toBe(0)
  })

  it('derives direction from the sign of the single amount column', () => {
    expect(byRef('UGF1XBK0N2')).toMatchObject({ kind: 'income', amountCents: 23500 })
    expect(byRef('UGF3XBKC5N')).toMatchObject({ kind: 'income', amountCents: 31200, merchant: 'Linnet Mwangi' })
    expect(byRef('UGA1XB2URQ')).toMatchObject({ kind: 'expense', amountCents: 66000, merchant: 'Andrew Mulupi' })
  })

  it('handles negative amounts with cents (regression on -3,115.56-style rows)', () => {
    expect(byRef('UG31XA6YVE')).toMatchObject({ kind: 'expense', amountCents: 500000, merchant: 'CUEA' })
  })

  it('stitches wrapped detail lines into the merchant, not the disclaimer', () => {
    const naivas = byRef('UGF1XBK0M2')
    expect(naivas?.kind).toBe('expense')
    expect(naivas?.amountCents).toBe(23500)
    expect(naivas?.merchant).toBe('Naivas West End Plaza')

    // The row before the page-break disclaimer keeps only its own details.
    expect(byRef('UG31XA6YVE')?.note).toBe('Pay Bill Online to 100205 - CUEA Acc. 1048076')
  })

  it('gives repeated receipts a deterministic suffix so the unique key holds', () => {
    expect(byRef('UGE1XBI19M')).toMatchObject({ kind: 'income', amountCents: 30700 })
    expect(byRef('UGE1XBI19M-1')).toMatchObject({ kind: 'expense', amountCents: 700 })
    expect(byRef('UGE1XBI19M-2')).toMatchObject({ kind: 'expense', amountCents: 30000 })
  })

  it('reads the completion time as a Nairobi instant (UTC+3)', () => {
    // 13:09:42 Nairobi = 10:09:42 UTC
    expect(byRef('UGF1XBK0N2')?.occurredAt).toBe('2026-07-15T10:09:42.000Z')
  })
})
