import { describe, expect, it } from 'vitest'
import { parseMpesaTimestamp } from './timestamp'

describe('parseMpesaTimestamp', () => {
  it('parses a 2-digit year as 20xx and converts Nairobi (+03:00) local time to UTC', () => {
    expect(parseMpesaTimestamp('5/7/26', '2:45 PM')).toBe('2026-07-05T11:45:00.000Z')
  })

  it('parses a 4-digit year', () => {
    expect(parseMpesaTimestamp('5/7/2026', '2:45 PM')).toBe('2026-07-05T11:45:00.000Z')
  })

  it('handles AM correctly, including 12 AM as midnight', () => {
    expect(parseMpesaTimestamp('3/7/26', '9:10 AM')).toBe('2026-07-03T06:10:00.000Z')
    expect(parseMpesaTimestamp('1/3/26', '12:00 AM')).toBe('2026-02-28T21:00:00.000Z')
  })

  it('handles PM correctly, including 12 PM as noon', () => {
    expect(parseMpesaTimestamp('1/1/26', '12:00 PM')).toBe('2026-01-01T09:00:00.000Z')
  })

  it('handles a leap-day date', () => {
    expect(parseMpesaTimestamp('29/2/28', '11:30 AM')).toBe('2028-02-29T08:30:00.000Z')
  })

  it('throws on an impossible date — never guesses', () => {
    expect(() => parseMpesaTimestamp('32/13/26', '3:15 PM')).toThrow()
    expect(() => parseMpesaTimestamp('29/2/26', '3:15 PM')).toThrow() // 2026 is not a leap year
    expect(() => parseMpesaTimestamp('31/4/26', '3:15 PM')).toThrow() // April has 30 days
  })

  it('throws on malformed date/time text', () => {
    expect(() => parseMpesaTimestamp('not-a-date', '3:15 PM')).toThrow()
    expect(() => parseMpesaTimestamp('5/7/26', 'not-a-time')).toThrow()
    expect(() => parseMpesaTimestamp('5/7/26', '13:15 PM')).toThrow() // hour out of 1-12 range
  })

  it('is stable across day boundaries — never uses raw device-local Date math', () => {
    // 23:59 PM Nairobi on the last day of the year rolls into Jan 1 UTC.
    expect(parseMpesaTimestamp('31/12/26', '11:59 PM')).toBe('2026-12-31T20:59:00.000Z')
  })
})
