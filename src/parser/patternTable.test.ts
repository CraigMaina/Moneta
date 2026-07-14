import { describe, expect, it } from 'vitest'
import { compiledPatterns, PARSER_VERSION } from './patternTable'

describe('patternTable', () => {
  it('loads a non-empty, versioned pattern table', () => {
    expect(PARSER_VERSION).toMatch(/^pattern-\d{4}\.\d{2}$/)
    expect(compiledPatterns.length).toBeGreaterThan(0)
  })

  it('every pattern id is unique', () => {
    const ids = compiledPatterns.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every pattern compiles to a RegExp with the required named groups', () => {
    for (const pattern of compiledPatterns) {
      expect(pattern.compiled).toBeInstanceOf(RegExp)
      const source = pattern.compiled.source
      expect(source).toContain('(?<ref>')
      expect(source).toContain('(?<amount>')
      expect(source).toContain('(?<date>')
      expect(source).toContain('(?<time>')
    }
  })

  it('reversal is the only family exempt from requiring counterAccountHint/transferDirection on transfer kind', () => {
    for (const pattern of compiledPatterns) {
      if (pattern.kind === 'transfer' && pattern.family !== 'reversal') {
        expect(pattern.counterAccountHint).not.toBeNull()
        expect(pattern.transferDirection).not.toBeNull()
      }
    }
  })

  it('no pattern with kind transfer carries a category (DB invariant: transfers have no category)', () => {
    for (const pattern of compiledPatterns) {
      if (pattern.kind === 'transfer') {
        expect(pattern.category).toBeNull()
      }
    }
  })
})
