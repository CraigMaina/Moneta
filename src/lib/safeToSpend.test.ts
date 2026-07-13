import { describe, expect, it } from 'vitest'
import { TZDate } from '@date-fns/tz'
import { calcSafeToSpend, currentPeriod, type CalcTxn } from './safeToSpend'

// Helper: an instant expressed as Nairobi wall-clock, returned as a plain Date.
function nairobi(y: number, m: number, d: number, hh = 12, mm = 0): Date {
  return new Date(new TZDate(y, m - 1, d, hh, mm, 0, 0, 'Africa/Nairobi').getTime())
}

const expense = (amountCents: number, occurredAt: Date): CalcTxn => ({ kind: 'expense', amountCents, occurredAt })
const income = (amountCents: number, occurredAt: Date): CalcTxn => ({ kind: 'income', amountCents, occurredAt })
const transfer = (amountCents: number, occurredAt: Date): CalcTxn => ({ kind: 'transfer', amountCents, occurredAt })

describe('currentPeriod', () => {
  it('defaults to the calendar month', () => {
    const { periodStart, periodEnd } = currentPeriod(nairobi(2026, 7, 13))
    expect(new TZDate(periodStart, 'Africa/Nairobi').getDate()).toBe(1)
    expect(new TZDate(periodStart, 'Africa/Nairobi').getMonth()).toBe(6) // July
    // End is the instant before Aug 1 → July 31, 23:59:59.999.
    const endLocal = new TZDate(periodEnd, 'Africa/Nairobi')
    expect(endLocal.getDate()).toBe(31)
    expect(endLocal.getMonth()).toBe(6)
    expect(endLocal.getHours()).toBe(23)
  })

  it('with a salary anchor, before the anchor day the period started last month', () => {
    const { periodStart, periodEnd } = currentPeriod(nairobi(2026, 7, 13), 25)
    const start = new TZDate(periodStart, 'Africa/Nairobi')
    expect(start.getMonth()).toBe(5) // June
    expect(start.getDate()).toBe(25)
    const end = new TZDate(periodEnd, 'Africa/Nairobi')
    expect(end.getMonth()).toBe(6) // July
    expect(end.getDate()).toBe(24)
  })

  it('with a salary anchor, on/after the anchor day the period started this month', () => {
    const { periodStart } = currentPeriod(nairobi(2026, 7, 26), 25)
    const start = new TZDate(periodStart, 'Africa/Nairobi')
    expect(start.getMonth()).toBe(6) // July
    expect(start.getDate()).toBe(25)
  })

  it('crosses the year boundary for a January-before-anchor date', () => {
    const { periodStart } = currentPeriod(nairobi(2026, 1, 10), 25)
    const start = new TZDate(periodStart, 'Africa/Nairobi')
    expect(start.getFullYear()).toBe(2025)
    expect(start.getMonth()).toBe(11) // December
    expect(start.getDate()).toBe(25)
  })

  it('rejects an out-of-range anchor', () => {
    expect(() => currentPeriod(nairobi(2026, 7, 13), 0)).toThrow(RangeError)
    expect(() => currentPeriod(nairobi(2026, 7, 13), 29)).toThrow(RangeError)
    expect(() => currentPeriod(nairobi(2026, 7, 13), 1.5)).toThrow(RangeError)
  })
})

describe('calcSafeToSpend — the number never lies', () => {
  it('divides the pool by days remaining, inclusive of today', () => {
    // July 13, 19 days remain (13..31). Income 3,000; nothing else.
    const r = calcSafeToSpend({
      now: nairobi(2026, 7, 13),
      expectedIncomeCents: 300000,
      transactions: [],
    })
    expect(r.daysRemaining).toBe(19)
    expect(r.poolCents).toBe(300000)
    expect(r.safeToSpendCents).toBe(Math.floor(300000 / 19)) // 15789
    expect(r.isOver).toBe(false)
  })

  it('EXCLUDES transfers entirely — a transfer never moves the number', () => {
    const baseline = calcSafeToSpend({
      now: nairobi(2026, 7, 13),
      expectedIncomeCents: 300000,
      transactions: [expense(50000, nairobi(2026, 7, 5))],
    })
    const withTransfer = calcSafeToSpend({
      now: nairobi(2026, 7, 13),
      expectedIncomeCents: 300000,
      transactions: [
        expense(50000, nairobi(2026, 7, 5)),
        // A huge withdrawal (M-PESA → Cash) must not change safe-to-spend.
        transfer(1000000, nairobi(2026, 7, 6)),
      ],
    })
    expect(withTransfer.safeToSpendCents).toBe(baseline.safeToSpendCents)
    expect(withTransfer.variableSpentCents).toBe(50000)
  })

  it('subtracts variable spend so far', () => {
    const r = calcSafeToSpend({
      now: nairobi(2026, 7, 13),
      expectedIncomeCents: 300000,
      transactions: [expense(60000, nairobi(2026, 7, 4)), expense(40000, nairobi(2026, 7, 9))],
    })
    expect(r.variableSpentCents).toBe(100000)
    expect(r.poolCents).toBe(200000)
    expect(r.safeToSpendCents).toBe(Math.floor(200000 / 19))
  })

  it('a bonus RAISES the number — uses max(declared, received so far)', () => {
    const r = calcSafeToSpend({
      now: nairobi(2026, 7, 13),
      expectedIncomeCents: 300000,
      transactions: [income(500000, nairobi(2026, 7, 2))], // actual > declared
    })
    expect(r.expectedIncomeCents).toBe(500000)
    expect(r.poolCents).toBe(500000)
  })

  it('uses declared income when actual received is lower (income still pending)', () => {
    const r = calcSafeToSpend({
      now: nairobi(2026, 7, 13),
      expectedIncomeCents: 300000,
      transactions: [income(50000, nairobi(2026, 7, 2))],
    })
    expect(r.expectedIncomeCents).toBe(300000)
    expect(r.incomeSoFarCents).toBe(50000)
  })

  it('reserves upcoming fixed bills and planned goal contributions', () => {
    const r = calcSafeToSpend({
      now: nairobi(2026, 7, 13),
      expectedIncomeCents: 300000,
      transactions: [],
      upcomingFixedBillsCents: 120000,
      plannedGoalContributionsCents: 40000,
    })
    expect(r.poolCents).toBe(300000 - 120000 - 40000)
  })

  it('goes negative as a PERIOD TOTAL (not per-day) when over budget', () => {
    const r = calcSafeToSpend({
      now: nairobi(2026, 7, 13),
      expectedIncomeCents: 300000,
      transactions: [expense(340000, nairobi(2026, 7, 6))],
    })
    expect(r.isOver).toBe(true)
    expect(r.poolCents).toBe(-40000)
    // Over state shows the total overage, not poolCents/daysRemaining.
    expect(r.safeToSpendCents).toBe(-40000)
  })

  it('on the last day of the period, days remaining is 1 and safe = the whole pool', () => {
    const r = calcSafeToSpend({
      now: nairobi(2026, 7, 31, 20, 0),
      expectedIncomeCents: 300000,
      transactions: [expense(280000, nairobi(2026, 7, 10))],
    })
    expect(r.daysRemaining).toBe(1)
    expect(r.safeToSpendCents).toBe(20000)
  })

  it('ignores transactions outside the current period', () => {
    const r = calcSafeToSpend({
      now: nairobi(2026, 7, 13),
      expectedIncomeCents: 300000,
      transactions: [
        expense(99999, nairobi(2026, 6, 30)), // last period — excluded
        expense(50000, nairobi(2026, 7, 4)), // this period — counted
      ],
    })
    expect(r.variableSpentCents).toBe(50000)
  })

  it('ignores future-dated transactions within the period (only spend up to now)', () => {
    const r = calcSafeToSpend({
      now: nairobi(2026, 7, 13, 12, 0),
      expectedIncomeCents: 300000,
      transactions: [
        expense(50000, nairobi(2026, 7, 4)), // past — counted
        expense(70000, nairobi(2026, 7, 20)), // future — excluded
      ],
    })
    expect(r.variableSpentCents).toBe(50000)
  })

  it('computes day boundaries in Africa/Nairobi regardless of device clock', () => {
    // 22:30 UTC on the 13th is 01:30 on the 14th in Nairobi (UTC+3).
    // A naive UTC calc would say "13th → 19 days"; Nairobi says "14th → 18 days".
    const r = calcSafeToSpend({
      now: new Date('2026-07-13T22:30:00Z'),
      expectedIncomeCents: 300000,
      transactions: [],
    })
    expect(r.daysRemaining).toBe(18)
  })

  it('a transaction at 23:30 UTC on the 13th counts in the Nairobi 14th (period-aware)', () => {
    // now = 03:00 Nairobi on the 14th; txn instant = 02:30 Nairobi on the 14th → counted.
    const r = calcSafeToSpend({
      now: new Date('2026-07-14T00:00:00Z'), // 03:00 Nairobi 14th
      expectedIncomeCents: 300000,
      transactions: [expense(50000, new Date('2026-07-13T23:30:00Z'))], // 02:30 Nairobi 14th
    })
    expect(r.variableSpentCents).toBe(50000)
  })

  it('rejects non-integer cents leaking into the money path', () => {
    expect(() =>
      calcSafeToSpend({ now: nairobi(2026, 7, 13), expectedIncomeCents: 3000.5, transactions: [] }),
    ).toThrow(TypeError)
    expect(() =>
      calcSafeToSpend({
        now: nairobi(2026, 7, 13),
        expectedIncomeCents: 300000,
        transactions: [expense(50000.25, nairobi(2026, 7, 4))],
      }),
    ).toThrow(TypeError)
  })

  it('handles a custom salary cycle spanning a month boundary', () => {
    // Anchor 25: on July 13 the period is Jun 25 → Jul 24 (12 days left incl. today).
    const r = calcSafeToSpend({
      now: nairobi(2026, 7, 13),
      cycleAnchorDay: 25,
      expectedIncomeCents: 300000,
      transactions: [
        expense(20000, nairobi(2026, 6, 26)), // in period (after Jun 25)
        expense(30000, nairobi(2026, 6, 24)), // before Jun 25 → excluded
      ],
    })
    expect(r.daysRemaining).toBe(12)
    expect(r.variableSpentCents).toBe(20000)
  })
})
