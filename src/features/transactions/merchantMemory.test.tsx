import type { PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { chainable, fakeAuthSession, ok, type RecordedCall } from '../../test/supabaseTestHelpers'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const CATEGORY_ID = '99999999-9999-4999-8999-999999999999'

const mockSupabase = vi.hoisted(() => ({
  auth: { getSession: vi.fn(), onAuthStateChange: vi.fn() },
  from: vi.fn(),
}))
vi.mock('../../lib/supabase', () => ({ supabase: mockSupabase }))

import { useMerchantRules, useSetMerchantRule } from './merchantMemory'

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
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

async function waitForAuthReady(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('useMerchantRules — joins category_id -> name into the parser MerchantRule shape', () => {
  it('maps object and array FK embeds and drops rows with no category', async () => {
    mockSupabase.from.mockImplementation(() =>
      chainable(
        ok([
          { merchant_normalized: 'NAIVAS', categories: { name: 'Food & Groceries' } },
          { merchant_normalized: 'GLOVO', categories: [{ name: 'Eating Out' }] },
          { merchant_normalized: 'ORPHAN', categories: null },
        ]),
      ),
    )

    const { result } = renderHook(() => useMerchantRules(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual([
      { merchantNormalized: 'NAIVAS', categoryName: 'Food & Groceries' },
      { merchantNormalized: 'GLOVO', categoryName: 'Eating Out' },
    ])
  })
})

describe('useSetMerchantRule — upsert with injected user_id', () => {
  it('upserts on (user_id, merchant_normalized) and never trusts a caller user_id', async () => {
    const calls: RecordedCall[] = []
    mockSupabase.from.mockImplementation(() => chainable(ok(null), (call) => calls.push(call)))

    const { result } = renderHook(() => useSetMerchantRule(), { wrapper })
    await waitForAuthReady()

    await act(async () => {
      result.current.mutate({ merchantNormalized: 'NAIVAS', categoryId: CATEGORY_ID })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const upsert = calls.find((c) => c.method === 'upsert')
    expect(upsert).toBeDefined()
    const payload = upsert?.args[0] as { user_id: string; merchant_normalized: string; category_id: string }
    expect(payload).toEqual({ user_id: USER_ID, merchant_normalized: 'NAIVAS', category_id: CATEGORY_ID })
    const options = upsert?.args[1] as { onConflict: string }
    expect(options.onConflict).toBe('user_id,merchant_normalized')
  })
})
