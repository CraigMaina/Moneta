import type { PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { chainable, fakeAuthSession, ok } from '../../test/supabaseTestHelpers'
import { calcSafeToSpend } from '../../lib/safeToSpend'
import type { Profile, RecurringItem, Transaction } from './types'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const MPESA_ID = '22222222-2222-4222-8222-222222222222'
const CASH_ID = '33333333-3333-4333-8333-333333333333'

const mockSupabase = vi.hoisted(() => ({
  auth: { getSession: vi.fn(), onAuthStateChange: vi.fn() },
  from: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({ supabase: mockSupabase }))

import { useSafeToSpend } from './useSafeToSpend'

function wrapper({ children }: PropsWithChildren) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

beforeEach(() => {
  mockSupabase.from.mockReset()
  mockSupabase.auth.getSession.mockReset()
  mockSupabase.auth.onAuthStateChange.mockReset()
  const session = fakeAuthSession(USER_ID)
  mockSupabase.auth.getSession.mockImplementation(session.getSession)
  mockSupabase.auth.onAuthStateChange.mockImplementation(session.onAuthStateChange)
})

function txn(overrides: Partial<Transaction> & Pick<Transaction, 'kind' | 'amount_cents' | 'occurred_at'>): Transaction {
  return {
    id: `txn-${Math.random()}`,
    user_id: USER_ID,
    account_id: MPESA_ID,
    counter_account_id: null,
    category_id: null,
    merchant: null,
    note: null,
    mpesa_ref: null,
    fee_cents: null,
    parser_version: null,
    raw_sms: null,
    source: 'manual',
    created_at: overrides.occurred_at,
    ...overrides,
  }
}

/**
 * Routes `supabase.from(table)` to per-table fake responses. `profiles` uses
 * `maybeSingle` (single-row shape); `transactions`/`recurring_items` are
 * arrays.
 */
function mockTables(tables: { profile: Profile | null; transactions: Transaction[]; recurring: RecurringItem[] }) {
  mockSupabase.from.mockImplementation((table: string) => {
    if (table === 'profiles') return chainable(ok(tables.profile))
    if (table === 'transactions') return chainable(ok(tables.transactions))
    if (table === 'recurring_items') return chainable(ok(tables.recurring))
    throw new Error(`unexpected table in test: ${table}`)
  })
}

const NOW = new Date('2026-07-13T12:00:00.000Z') // Nairobi 15:00, mid cycle for both anchors below

describe('useSafeToSpend — composes DB rows into calcSafeToSpend and returns its result unmodified', () => {
  it('matches calcSafeToSpend for the same inputs: calendar-month anchor, income + expense + upcoming bill', async () => {
    const profile: Profile = {
      id: 'profile-1',
      user_id: USER_ID,
      display_name: 'Amina',
      cycle_anchor_day: 1,
      expected_income_cents: 300000,
      notification_prefs: {},
      consent_flags: {},
      pin_hash: null,
      created_at: '2026-01-01',
    }
    const transactions: Transaction[] = [
      txn({ kind: 'income', amount_cents: 300000, occurred_at: '2026-07-02T09:00:00.000Z' }),
      txn({ kind: 'expense', amount_cents: 45000, occurred_at: '2026-07-10T09:00:00.000Z' }),
      // A transfer inside the period must NOT move the number.
      txn({
        kind: 'transfer',
        amount_cents: 999999,
        account_id: MPESA_ID,
        counter_account_id: CASH_ID,
        occurred_at: '2026-07-11T09:00:00.000Z',
      }),
    ]
    const recurring: RecurringItem[] = [
      {
        id: 'r1',
        user_id: USER_ID,
        account_id: MPESA_ID,
        category_id: null,
        amount_cents: 20000,
        kind: 'expense',
        cadence: 'monthly',
        autopay: false,
        merchant: 'DSTV',
        next_due_date: '2026-07-25',
        note: null,
        created_at: '2026-01-01',
      },
    ]
    mockTables({ profile, transactions, recurring })

    const { result } = renderHook(() => useSafeToSpend({ now: NOW }), { wrapper })

    await waitFor(() => expect(result.current.data).toBeDefined())

    const expected = calcSafeToSpend({
      now: NOW,
      cycleAnchorDay: 1,
      expectedIncomeCents: 300000,
      transactions: [
        { kind: 'income', amountCents: 300000, occurredAt: new Date('2026-07-02T09:00:00.000Z') },
        { kind: 'expense', amountCents: 45000, occurredAt: new Date('2026-07-10T09:00:00.000Z') },
        { kind: 'transfer', amountCents: 999999, occurredAt: new Date('2026-07-11T09:00:00.000Z') },
      ],
      upcomingFixedBillsCents: 20000,
      plannedGoalContributionsCents: 0,
    })

    expect(result.current.data).toMatchObject(expected)
    // The transfer's huge amount must not have leaked into the pool.
    expect(result.current.data?.variableSpentCents).toBe(45000)
  })

  it('matches calcSafeToSpend with a custom cycle anchor day', async () => {
    const profile: Profile = {
      id: 'profile-2',
      user_id: USER_ID,
      display_name: 'Kev',
      cycle_anchor_day: 25,
      expected_income_cents: 150000,
      notification_prefs: {},
      consent_flags: {},
      pin_hash: null,
      created_at: '2026-01-01',
    }
    const transactions: Transaction[] = [
      txn({ kind: 'expense', amount_cents: 8000, occurred_at: '2026-07-05T09:00:00.000Z' }),
    ]
    mockTables({ profile, transactions, recurring: [] })

    const { result } = renderHook(() => useSafeToSpend({ now: NOW }), { wrapper })

    await waitFor(() => expect(result.current.data).toBeDefined())

    const expected = calcSafeToSpend({
      now: NOW,
      cycleAnchorDay: 25,
      expectedIncomeCents: 150000,
      transactions: [{ kind: 'expense', amountCents: 8000, occurredAt: new Date('2026-07-05T09:00:00.000Z') }],
      upcomingFixedBillsCents: 0,
      plannedGoalContributionsCents: 0,
    })

    expect(result.current.data).toMatchObject(expected)
  })

  it('goes negative (isOver) when unpaid upcoming bills exceed the remaining pool, matching calcSafeToSpend', async () => {
    const profile: Profile = {
      id: 'profile-3',
      user_id: USER_ID,
      display_name: 'Kev',
      cycle_anchor_day: 1,
      expected_income_cents: 50000,
      notification_prefs: {},
      consent_flags: {},
      pin_hash: null,
      created_at: '2026-01-01',
    }
    const recurring: RecurringItem[] = [
      {
        id: 'r2',
        user_id: USER_ID,
        account_id: MPESA_ID,
        category_id: null,
        amount_cents: 200000,
        kind: 'expense',
        cadence: 'monthly',
        autopay: false,
        merchant: 'Landlord',
        next_due_date: '2026-07-28',
        note: null,
        created_at: '2026-01-01',
      },
    ]
    mockTables({ profile, transactions: [], recurring })

    const { result } = renderHook(() => useSafeToSpend({ now: NOW }), { wrapper })

    await waitFor(() => expect(result.current.data).toBeDefined())

    const expected = calcSafeToSpend({
      now: NOW,
      cycleAnchorDay: 1,
      expectedIncomeCents: 50000,
      transactions: [],
      upcomingFixedBillsCents: 200000,
      plannedGoalContributionsCents: 0,
    })

    expect(result.current.data).toMatchObject(expected)
    expect(result.current.data?.isOver).toBe(true)
    expect(expected.isOver).toBe(true)
  })

  it('falls back to defaults (0 declared income, calendar-month anchor) when no profile row exists yet', async () => {
    mockTables({ profile: null, transactions: [], recurring: [] })

    const { result } = renderHook(() => useSafeToSpend({ now: NOW }), { wrapper })

    await waitFor(() => expect(result.current.data).toBeDefined())

    const expected = calcSafeToSpend({
      now: NOW,
      cycleAnchorDay: 1,
      expectedIncomeCents: 0,
      transactions: [],
      upcomingFixedBillsCents: 0,
      plannedGoalContributionsCents: 0,
    })

    expect(result.current.data).toMatchObject(expected)
  })

  it('exposes spentTodayCents (Nairobi day, transfers excluded) and dailyBudgetCents for the hero arc', async () => {
    const profile: Profile = {
      id: 'profile-hero',
      user_id: USER_ID,
      display_name: 'Amina',
      cycle_anchor_day: 1,
      expected_income_cents: 300000,
      notification_prefs: {},
      consent_flags: {},
      pin_hash: null,
      created_at: '2026-01-01',
    }
    const transactions: Transaction[] = [
      // Today (NOW = Nairobi 15:00 on the 13th): an expense and a transfer.
      txn({ kind: 'expense', amount_cents: 12000, occurred_at: '2026-07-13T08:00:00.000Z' }),
      txn({
        kind: 'transfer',
        amount_cents: 500000,
        account_id: MPESA_ID,
        counter_account_id: CASH_ID,
        occurred_at: '2026-07-13T09:00:00.000Z',
      }),
      // Earlier this period — not "today".
      txn({ kind: 'expense', amount_cents: 30000, occurred_at: '2026-07-05T09:00:00.000Z' }),
    ]
    mockTables({ profile, transactions, recurring: [] })

    const { result } = renderHook(() => useSafeToSpend({ now: NOW }), { wrapper })
    await waitFor(() => expect(result.current.data).toBeDefined())

    // Only today's expense counts; the transfer is excluded, the 5th is not today.
    expect(result.current.data?.spentTodayCents).toBe(12000)
    // Gross allowance = max(0, safeToSpend) + spentToday.
    const d = result.current.data!
    expect(d.dailyBudgetCents).toBe(Math.max(0, d.safeToSpendCents) + 12000)
  })

  it('reports no data/loading result until every underlying query has settled', async () => {
    mockSupabase.from.mockImplementation(() => chainable(ok(null)))

    const { result } = renderHook(() => useSafeToSpend({ now: NOW }), { wrapper })

    // Before the session/queries resolve, there's nothing to show yet.
    expect(result.current.data).toBeUndefined()

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.isError).toBe(false)
  })
})
