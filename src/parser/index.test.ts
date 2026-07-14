import { describe, expect, it } from 'vitest'
import { parseMpesaMessage, parsedMpesaMessageSchema } from './index'

describe('parseMpesaMessage', () => {
  it('returns unmatched for empty/whitespace-only input', () => {
    expect(parseMpesaMessage('').status).toBe('unmatched')
    expect(parseMpesaMessage('   \n  ').status).toBe('unmatched')
  })

  it('returns unmatched (never a guess) for text that resembles but does not match any known format', () => {
    const result = parseMpesaMessage('Hey, can you send me some money later today?')
    expect(result.status).toBe('unmatched')
    if (result.status === 'unmatched') {
      expect(result.raw).toBe('Hey, can you send me some money later today?')
    }
  })

  it('matches a well-formed message and the result validates against the exported schema', () => {
    const result = parseMpesaMessage(
      'QGH7XXXXX1 Confirmed. You have received Ksh1,500.00 from JOHN KAMAU 0722123456 on 5/7/26 at 2:45 PM. New M-PESA balance is Ksh3,200.00.',
    )
    expect(result.status).toBe('matched')
    if (result.status === 'matched') {
      expect(() => parsedMpesaMessageSchema.parse(result.data)).not.toThrow()
      expect(result.data.parserVersion).toMatch(/^pattern-\d{4}\.\d{2}$/)
    }
  })

  it('is insensitive to leading/trailing whitespace on the raw input', () => {
    const result = parseMpesaMessage(
      '   QGH7XXXXX1 Confirmed. You have received Ksh1,500.00 from JOHN KAMAU 0722123456 on 5/7/26 at 2:45 PM. New M-PESA balance is Ksh3,200.00.   ',
    )
    expect(result.status).toBe('matched')
  })

  it('every matched result carries a distinct patternId that traces back to patterns.json', () => {
    const result = parseMpesaMessage(
      'AIR1ZZZZZ1 Confirmed. You bought Ksh100.00 of airtime on 16/7/26 at 6:00 PM. New M-PESA balance is Ksh400.00.',
    )
    expect(result.status).toBe('matched')
    if (result.status === 'matched') {
      expect(result.data.patternId).toBe('airtime-v1')
      expect(result.data.family).toBe('airtime')
    }
  })
})
