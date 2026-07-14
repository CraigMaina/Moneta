import { describe, expect, it } from 'vitest'
import { formatOccurredAt } from './dateFormat'

describe('formatOccurredAt', () => {
  it('renders a correct ISO instant as Africa/Nairobi wall-clock time (UTC+3)', () => {
    // 2026-07-11T08:00:00.000Z is the withdrawal fixture's occurredAt, whose
    // source SMS says "11/7/26 at 11:00 AM" (Nairobi local) — see
    // src/parser/__fixtures__/withdrawal.ts.
    expect(formatOccurredAt('2026-07-11T08:00:00.000Z')).toBe('Jul 11, 11:00 AM')
  })

  it('crosses the noon boundary correctly', () => {
    // received fixture: "1/1/26 at 12:00 PM" Nairobi -> 09:00 UTC.
    expect(formatOccurredAt('2026-01-01T09:00:00.000Z')).toBe('Jan 1, 12:00 PM')
  })

  it('rolls the calendar day forward across the UTC/Nairobi boundary', () => {
    // 22:30 UTC on the 13th is 01:30 Nairobi on the 14th.
    expect(formatOccurredAt('2026-07-13T22:30:00.000Z')).toBe('Jul 14, 1:30 AM')
  })
})
