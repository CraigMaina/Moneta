import { describe, expect, it } from 'vitest'
import { normalizeMerchant, resolveMerchantCategory } from './merchant'
import type { MerchantRule } from './merchant'

describe('normalizeMerchant', () => {
  it('trims and uppercases', () => {
    expect(normalizeMerchant('  naivas prestige  ')).toBe('NAIVAS PRESTIGE')
  })

  it('collapses internal whitespace', () => {
    expect(normalizeMerchant('Java   House   Westlands')).toBe('JAVA HOUSE WESTLANDS')
  })

  it('strips a trailing phone number (0-prefixed)', () => {
    expect(normalizeMerchant('JOHN KAMAU 0722123456')).toBe('JOHN KAMAU')
  })

  it('strips a trailing phone number (254-prefixed)', () => {
    expect(normalizeMerchant('MARY WANJIKU 254722123456')).toBe('MARY WANJIKU')
  })

  it('strips a trailing till/agent numeric code', () => {
    expect(normalizeMerchant('NAIVAS PRESTIGE 174379')).toBe('NAIVAS PRESTIGE')
  })

  it('strips trailing punctuation left over after code removal', () => {
    expect(normalizeMerchant('NAIVAS LTD.')).toBe('NAIVAS LTD')
    expect(normalizeMerchant('NAIVAS LTD -')).toBe('NAIVAS LTD')
  })

  it('two differently-formatted raw strings normalize to the same key', () => {
    const a = normalizeMerchant('Naivas Prestige  174379')
    const b = normalizeMerchant('NAIVAS PRESTIGE')
    expect(a).toBe(b)
  })

  it('leaves short numbers that are part of the name alone (not a phone/code pattern)', () => {
    expect(normalizeMerchant('SHOP 24')).toBe('SHOP 24')
  })
})

describe('resolveMerchantCategory', () => {
  const rules: MerchantRule[] = [
    { merchantNormalized: 'NAIVAS PRESTIGE', categoryName: 'Food & Groceries' },
    { merchantNormalized: 'JAVA HOUSE WESTLANDS', categoryName: 'Eating Out' },
  ]

  it('returns the matching rule category', () => {
    expect(resolveMerchantCategory('NAIVAS PRESTIGE', rules)).toBe('Food & Groceries')
  })

  it('returns null when no rule matches', () => {
    expect(resolveMerchantCategory('UNKNOWN MERCHANT', rules)).toBeNull()
  })

  it('is an exact match on the normalized key, not a substring match', () => {
    expect(resolveMerchantCategory('NAIVAS', rules)).toBeNull()
  })

  it('returns null for an empty rules list', () => {
    expect(resolveMerchantCategory('NAIVAS PRESTIGE', [])).toBeNull()
  })
})
