import { describe, expect, it } from 'vitest'
import { advanceDueDate, dueStatus, isCadence, isDueSoonOrOverdue } from './cadence'

describe('isCadence', () => {
  it('accepts the known cadences only', () => {
    expect(isCadence('weekly')).toBe(true)
    expect(isCadence('monthly')).toBe(true)
    expect(isCadence('daily')).toBe(false)
  })
})

describe('advanceDueDate', () => {
  it('advances weekly by 7 days', () => {
    expect(advanceDueDate('2026-07-15', 'weekly')).toBe('2026-07-22')
    expect(advanceDueDate('2026-07-28', 'weekly')).toBe('2026-08-04')
  })

  it('advances monthly by one calendar month', () => {
    expect(advanceDueDate('2026-07-15', 'monthly')).toBe('2026-08-15')
    expect(advanceDueDate('2026-12-15', 'monthly')).toBe('2027-01-15')
  })

  it('clamps a monthly step to the end of a shorter month', () => {
    // Jan 31 + 1 month → Feb 28 (date-fns clamps, never rolls into March).
    expect(advanceDueDate('2026-01-31', 'monthly')).toBe('2026-02-28')
  })
})

describe('dueStatus', () => {
  const now = new Date('2026-07-15T09:00:00.000Z') // 2026-07-15 in Nairobi

  it('flags a past date as overdue', () => {
    expect(dueStatus('2026-07-14', now)).toBe('overdue')
  })

  it('flags today and the next two days as due-soon', () => {
    expect(dueStatus('2026-07-15', now)).toBe('due-soon')
    expect(dueStatus('2026-07-17', now)).toBe('due-soon')
  })

  it('flags anything further out as upcoming', () => {
    expect(dueStatus('2026-07-18', now)).toBe('upcoming')
  })
})

describe('isDueSoonOrOverdue', () => {
  const now = new Date('2026-07-15T09:00:00.000Z')
  it('is true for overdue and due-soon, false for upcoming', () => {
    expect(isDueSoonOrOverdue('2026-07-10', now)).toBe(true)
    expect(isDueSoonOrOverdue('2026-07-16', now)).toBe(true)
    expect(isDueSoonOrOverdue('2026-08-01', now)).toBe(false)
  })
})
