import type { PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { chainable, fakeAuthSession, ok, fail, type RecordedCall } from '../../test/supabaseTestHelpers'
import type { Account, AccountBalance, Category, Profile, RecurringItem, Transaction } from './types'

const USER_ID = '11111111-1111-4111-8111-111111111111'

const mockSupabase = vi.hoisted(() => ({
  auth: { getSession: vi.fn(), onAuthStateChange: vi.fn() },
  from: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({ supabase: mockSupabase }))

import {
  useAccountBalances,
  useAccounts,
  useCategories,
  useProfile,
  useTransactions,
  useUpcomingRecurringBills,
} from './queries'

function wrapper({ children }: PropsWithChildren) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

function authenticate(): void {
  const session = fakeAuthSession(USER_ID)
  mockSupabase.auth.getSession.mockImplementation(session.getSession)
  mockSupabase.auth.onAuthStateChange.mockImplementation(session.onAuthStateChange)
}

beforeEach(() => {
  mockSupabase.from.mockReset()
  mockSupabase.auth.getSession.mockReset()
  mockSupabase.auth.onAuthStateChange.mockReset()
})

describe('useAccounts', () => {
  it('is disabled until a user id resolves, then fetches accounts ordered by created_at', async () => {
    authenticate()
    const rows: Account[] = [
      { id: 'a1', user_id: USER_ID, name: 'M-PESA', type: 'mpesa', icon: null, archived_at: null, created_at: '2026-01-01' },
    ]
    let calledTable: string | undefined
    mockSupabase.from.mockImplementation((table: string) => {
      calledTable = table
      return chainable(ok(rows))
    })

    const { result } = renderHook(() => useAccounts(), { wrapper })

    expect(result.current.isPending).toBe(true)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(rows)
    expect(calledTable).toBe('accounts')
  })

  it('never queries when there is no authenticated user', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
    mockSupabase.auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })

    const { result } = renderHook(() => useAccounts(), { wrapper })

    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'))
    expect(mockSupabase.from).not.toHaveBeenCalled()
  })

  it('surfaces a Supabase error', async () => {
    authenticate()
    mockSupabase.from.mockImplementation(() => chainable(fail('boom')))

    const { result } = renderHook(() => useAccounts(), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useCategories', () => {
  it('fetches categories ordered by sort_order', async () => {
    authenticate()
    const rows: Category[] = [
      {
        id: 'c1',
        user_id: USER_ID,
        name: 'Groceries',
        kind: 'expense',
        sort_order: 1,
        icon: null,
        color: null,
        archived_at: null,
        created_at: '2026-01-01',
      },
    ]
    mockSupabase.from.mockImplementation(() => chainable(ok(rows)))

    const { result } = renderHook(() => useCategories(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(rows)
  })
})

describe('useTransactions', () => {
  it('applies from/to/limit filters and orders occurred_at desc for the UI to group by day', async () => {
    authenticate()
    const rows: Transaction[] = []
    const calls: RecordedCall[] = []
    mockSupabase.from.mockImplementation(() => chainable(ok(rows), (call) => calls.push(call)))

    const from = new Date('2026-07-01T00:00:00.000Z')
    const to = new Date('2026-07-13T00:00:00.000Z')
    const { result } = renderHook(() => useTransactions({ from, to, limit: 50 }), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(calls.some((c) => c.method === 'order' && c.args[0] === 'occurred_at')).toBe(true)
    expect(calls.some((c) => c.method === 'gte' && c.args[0] === 'occurred_at' && c.args[1] === from.toISOString())).toBe(true)
    expect(calls.some((c) => c.method === 'lte' && c.args[0] === 'occurred_at' && c.args[1] === to.toISOString())).toBe(true)
    expect(calls.some((c) => c.method === 'limit' && c.args[0] === 50)).toBe(true)
  })

  it('fetches without date bounds when none are given', async () => {
    authenticate()
    mockSupabase.from.mockImplementation(() => chainable(ok([] as Transaction[])))

    const { result } = renderHook(() => useTransactions(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })
})

describe('useAccountBalances', () => {
  it('reads the account_balances view', async () => {
    authenticate()
    const rows: AccountBalance[] = [{ account_id: 'a1', account_name: 'M-PESA', balance_cents: 10000, user_id: USER_ID }]
    let calledTable: string | undefined
    mockSupabase.from.mockImplementation((table: string) => {
      calledTable = table
      return chainable(ok(rows))
    })

    const { result } = renderHook(() => useAccountBalances(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(rows)
    expect(calledTable).toBe('account_balances')
  })
})

describe('useProfile', () => {
  it('returns the single profile row via maybeSingle', async () => {
    authenticate()
    const row: Profile = {
      id: 'p1',
      user_id: USER_ID,
      display_name: 'Amina',
      cycle_anchor_day: 25,
      expected_income_cents: 300000,
      notification_prefs: {},
      consent_flags: {},
      pin_hash: null,
      created_at: '2026-01-01',
    }
    mockSupabase.from.mockImplementation(() => chainable(ok(row)))

    const { result } = renderHook(() => useProfile(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(row)
  })

  it('resolves to null (not stuck loading) when no profile row exists yet', async () => {
    authenticate()
    mockSupabase.from.mockImplementation(() => chainable(ok(null)))

    const { result } = renderHook(() => useProfile(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBeNull()
  })
})

describe('useUpcomingRecurringBills', () => {
  it('filters to kind=expense and next_due_date within [from, to] as Nairobi calendar dates', async () => {
    authenticate()
    const rows: RecurringItem[] = []
    const calls: RecordedCall[] = []
    mockSupabase.from.mockImplementation(() => chainable(ok(rows), (call) => calls.push(call)))

    const from = new Date('2026-07-13T12:00:00.000Z')
    const to = new Date('2026-07-31T21:00:00.000Z')
    const { result } = renderHook(() => useUpcomingRecurringBills({ from, to }), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(calls.some((c) => c.method === 'eq' && c.args[0] === 'kind' && c.args[1] === 'expense')).toBe(true)
    expect(calls.some((c) => c.method === 'gte' && c.args[0] === 'next_due_date' && c.args[1] === '2026-07-13')).toBe(true)
    expect(calls.some((c) => c.method === 'lte' && c.args[0] === 'next_due_date' && c.args[1] === '2026-08-01')).toBe(true)
  })
})
