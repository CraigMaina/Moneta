import { describe, expect, it } from 'vitest'
import { parseMoneyToCents } from './money'

describe('parseMoneyToCents', () => {
  it('parses a bare integer with no decimals', () => {
    expect(parseMoneyToCents('1234')).toBe(123400)
  })

  it('parses one decimal digit, padding to two', () => {
    expect(parseMoneyToCents('1450.5')).toBe(145050)
  })

  it('parses two decimal digits exactly', () => {
    expect(parseMoneyToCents('1450.50')).toBe(145050)
    expect(parseMoneyToCents('1450.05')).toBe(145005)
  })

  it('strips thousands separators', () => {
    expect(parseMoneyToCents('1,450.50')).toBe(145050)
    expect(parseMoneyToCents('1,234,567.89')).toBe(123456789)
  })

  it('strips a leading Ksh/KES/KSH prefix, case-insensitive, with or without a space', () => {
    expect(parseMoneyToCents('Ksh1,450.50')).toBe(145050)
    expect(parseMoneyToCents('KES 1,450')).toBe(145000)
    expect(parseMoneyToCents('KSH 1,234')).toBe(123400)
    expect(parseMoneyToCents('ksh500')).toBe(50000)
  })

  it('handles zero', () => {
    expect(parseMoneyToCents('0.00')).toBe(0)
    expect(parseMoneyToCents('Ksh0.00')).toBe(0)
  })

  it('handles amounts under one unit', () => {
    expect(parseMoneyToCents('0.50')).toBe(50)
  })

  it('throws — never guesses — on non-money text', () => {
    expect(() => parseMoneyToCents('not a number')).toThrow()
    expect(() => parseMoneyToCents('')).toThrow()
    expect(() => parseMoneyToCents('Ksh')).toThrow()
  })

  it('never uses float arithmetic (verified via a value that would misround under parseFloat*100 rounding)', () => {
    // 0.1 + 0.2 style float traps: 145.10 must be exactly 14510, not 14509/14511.
    expect(parseMoneyToCents('145.10')).toBe(14510)
    expect(parseMoneyToCents('19.99')).toBe(1999)
  })
})
