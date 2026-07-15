import type { PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { chainable, fakeAuthSession, ok, type RecordedCall } from '../../test/supabaseTestHelpers'
import type { RecurringItem } from '../transactions/types'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const ACCOUNT_ID = '22222222-2222-4222-8222-222222222222'

const mockSupabase = vi.hoisted(() => ({
  auth: { getSession: vi.fn(), onAuthStateChange: vi.fn() },
  from: vi.fn(),
}))
vi.mock('../../lib/supabase', () => ({ supabase: mockSupabase }))

import { useMarkRecurringPaid } from './mutations'

function authenticate(): void {
  const session = fakeAuthSession(USER_ID)
  mockSupabase.auth.getSession.mockImplementation(session.getSession)
  mockSupabase.auth.onAuthStateChange.mockImplementation(session.onAuthStateChange)
}

beforeEach(() => {
  mockSupabase.from.mockReset()
  mockSupabase.auth.getSession.mockReset()
  mockSupabase.auth.onAuthStateChange.mockReset()
  authenticate()
})

function wrapper({ children }: PropsWithChildren) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

async function waitForAuthReady(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

const item: RecurringItem = {
  id: 'r1',
  user_id: USER_ID,
  account_id: ACCOUNT_ID,
  category_id: null,
  kind: 'expense',
  amount_cents: 3_000_00,
  merchant: 'Rent',
  note: null,
  cadence: 'monthly',
  next_due_date: '2026-07-15',
  autopay: false,
  created_at: '2026-07-01T00:00:00.000Z',
}

describe('useMarkRecurringPaid', () => {
  it('books a transaction from the template and advances the due date one cadence step', async () => {
    const txnCalls: RecordedCall[] = []
    const recurringCalls: RecordedCall[] = []
    mockSupabase.from
      .mockReturnValueOnce(chainable(ok(null), (c) => txnCalls.push(c))) // transactions insert
      .mockReturnValueOnce(chainable(ok(null), (c) => recurringCalls.push(c))) // recurring_items update

    const { result } = renderHook(() => useMarkRecurringPaid(), { wrapper })
    await waitForAuthReady()
    await act(async () => {
      await result.current.mutateAsync(item)
    })

    // A transaction was inserted from the template, scoped to the user.
    const insert = txnCalls.find((c) => c.method === 'insert')
    expect(insert?.args[0]).toMatchObject({
      kind: 'expense',
      amount_cents: 3_000_00,
      account_id: ACCOUNT_ID,
      user_id: USER_ID,
    })

    // The due date advanced monthly: 2026-07-15 → 2026-08-15.
    const update = recurringCalls.find((c) => c.method === 'update')
    expect(update?.args[0]).toEqual({ next_due_date: '2026-08-15' })
  })
})
