import { describe, expect, it } from 'vitest'
import { countDay, daysBetween, streakView, type StreakState } from './streaks'

const fresh: StreakState = { currentCount: 0, longestCount: 0, lastCountedDate: null, freezesUsedThisWeek: 0 }

describe('daysBetween', () => {
  it('counts calendar days in order', () => {
    expect(daysBetween('2026-07-15', '2026-07-16')).toBe(1)
    expect(daysBetween('2026-07-15', '2026-07-15')).toBe(0)
    expect(daysBetween('2026-07-31', '2026-08-02')).toBe(2)
  })
})

describe('countDay', () => {
  it('starts a streak at 1 from nothing', () => {
    expect(countDay(fresh, '2026-07-15')).toEqual({
      currentCount: 1,
      longestCount: 1,
      lastCountedDate: '2026-07-15',
      freezesUsedThisWeek: 0,
    })
  })

  it('is idempotent for a day already counted', () => {
    const state: StreakState = { currentCount: 3, longestCount: 5, lastCountedDate: '2026-07-15', freezesUsedThisWeek: 0 }
    expect(countDay(state, '2026-07-15')).toBe(state)
  })

  it('extends on a consecutive day', () => {
    const state: StreakState = { currentCount: 3, longestCount: 3, lastCountedDate: '2026-07-15', freezesUsedThisWeek: 0 }
    expect(countDay(state, '2026-07-16')).toMatchObject({ currentCount: 4, longestCount: 4, lastCountedDate: '2026-07-16' })
  })

  it('forgives a single missed day using the weekly freeze', () => {
    // Wed → Fri (missed Thu), same week, freeze available.
    const state: StreakState = { currentCount: 4, longestCount: 4, lastCountedDate: '2026-07-15', freezesUsedThisWeek: 0 }
    const next = countDay(state, '2026-07-17')
    expect(next).toMatchObject({ currentCount: 5, freezesUsedThisWeek: 1, lastCountedDate: '2026-07-17' })
  })

  it('breaks when the freeze was already used this week', () => {
    const state: StreakState = { currentCount: 5, longestCount: 6, lastCountedDate: '2026-07-15', freezesUsedThisWeek: 1 }
    // Another single-day gap in the same week, no freeze left → reset to 1.
    expect(countDay(state, '2026-07-17')).toMatchObject({ currentCount: 1, longestCount: 6 })
  })

  it('breaks when more than one day is missed', () => {
    const state: StreakState = { currentCount: 9, longestCount: 9, lastCountedDate: '2026-07-15', freezesUsedThisWeek: 0 }
    // 3-day gap (missed 2 days) → reset to 1, longest preserved.
    expect(countDay(state, '2026-07-18')).toMatchObject({ currentCount: 1, longestCount: 9 })
  })

  it('resets the freeze allowance in a new week', () => {
    // Last counted Sun 2026-07-19; today Tue 2026-07-21 (missed Mon) — new week, so
    // the freeze is fresh and forgives the missed day.
    const state: StreakState = { currentCount: 7, longestCount: 7, lastCountedDate: '2026-07-19', freezesUsedThisWeek: 1 }
    const next = countDay(state, '2026-07-21')
    expect(next).toMatchObject({ currentCount: 8, freezesUsedThisWeek: 1 })
  })
})

describe('streakView', () => {
  it('marks today counted and not at risk', () => {
    const state: StreakState = { currentCount: 4, longestCount: 4, lastCountedDate: '2026-07-15', freezesUsedThisWeek: 0 }
    expect(streakView(state, '2026-07-15')).toEqual({ currentCount: 4, countedToday: true, atRisk: false })
  })

  it('flags a live streak not yet kept today as at risk', () => {
    const state: StreakState = { currentCount: 4, longestCount: 4, lastCountedDate: '2026-07-14', freezesUsedThisWeek: 0 }
    expect(streakView(state, '2026-07-15')).toEqual({ currentCount: 4, countedToday: false, atRisk: true })
  })
})
