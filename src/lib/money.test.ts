import { describe, expect, it } from 'vitest'
import { centsToUnits, formatAmount, formatKES, unitsToCents } from './money'

describe('formatKES', () => {
  it('formats whole KES with no decimals', () => {
    expect(formatKES(145000)).toBe('KES 1,450')
  })

  it('formats zero as KES 0', () => {
    expect(formatKES(0)).toBe('KES 0')
  })

  it('shows two decimals only when the cents part is non-zero', () => {
    expect(formatKES(145050)).toBe('KES 1,450.50')
    expect(formatKES(145005)).toBe('KES 1,450.05')
    expect(formatKES(99)).toBe('KES 0.99')
  })

  it('groups thousands and millions', () => {
    expect(formatKES(100000000)).toBe('KES 1,000,000')
    expect(formatKES(1234567800)).toBe('KES 12,345,678')
  })

  it('formats small sub-unit amounts', () => {
    expect(formatKES(5)).toBe('KES 0.05')
    expect(formatKES(100)).toBe('KES 1')
  })

  it('formats negatives with a leading sign (safe-to-spend can go negative)', () => {
    expect(formatKES(-145000)).toBe('-KES 1,450')
    expect(formatKES(-145050)).toBe('-KES 1,450.50')
  })

  it('omits the symbol when asked', () => {
    expect(formatKES(145000, { withSymbol: false })).toBe('1,450')
    expect(formatKES(-145050, { withSymbol: false })).toBe('-1,450.50')
  })

  it('accepts bigint cents', () => {
    expect(formatKES(145000n)).toBe('KES 1,450')
    expect(formatKES(0n)).toBe('KES 0')
  })

  it('rejects floats leaking into the money path', () => {
    expect(() => formatKES(1450.5)).toThrow(TypeError)
  })

  it('rejects non-finite input', () => {
    expect(() => formatKES(Number.NaN)).toThrow(TypeError)
    expect(() => formatKES(Number.POSITIVE_INFINITY)).toThrow(TypeError)
  })

  it('rejects bigint beyond the safe integer range', () => {
    expect(() => formatKES(BigInt(Number.MAX_SAFE_INTEGER) + 1n)).toThrow(RangeError)
  })
})

describe('formatAmount', () => {
  it('is formatKES without the symbol', () => {
    expect(formatAmount(145000)).toBe('1,450')
    expect(formatAmount(145050)).toBe('1,450.50')
    expect(formatAmount(-100)).toBe('-1')
  })
})

describe('centsToUnits / unitsToCents', () => {
  it('round-trips whole units', () => {
    expect(unitsToCents(1450)).toBe(145000)
    expect(centsToUnits(145000)).toBe(1450)
  })

  it('truncates sub-unit cents toward zero', () => {
    expect(centsToUnits(145099)).toBe(1450)
    expect(centsToUnits(-145099)).toBe(-1450)
  })

  it('rejects non-integer units', () => {
    expect(() => unitsToCents(10.5)).toThrow(TypeError)
  })
})
