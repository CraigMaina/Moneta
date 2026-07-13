import { describe, expect, it } from 'vitest'
import { toNairobiDateString } from './nairobiDate'

describe('toNairobiDateString', () => {
  it('formats a midday UTC instant as the same calendar date in Nairobi (UTC+3)', () => {
    expect(toNairobiDateString(new Date('2026-07-13T12:00:00.000Z'))).toBe('2026-07-13')
  })

  it('rolls a late-UTC-evening instant into the next Nairobi day', () => {
    // 22:30 UTC on the 13th is 01:30 on the 14th in Nairobi (UTC+3).
    expect(toNairobiDateString(new Date('2026-07-13T22:30:00.000Z'))).toBe('2026-07-14')
  })

  it('zero-pads single-digit months and days', () => {
    expect(toNairobiDateString(new Date('2026-01-05T06:00:00.000Z'))).toBe('2026-01-05')
  })
})
