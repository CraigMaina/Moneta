import type { PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { chainable, fakeAuthSession, ok, type RecordedCall } from '../../test/supabaseTestHelpers'

const USER_ID = '11111111-1111-4111-8111-111111111111'

const mockSupabase = vi.hoisted(() => ({
  auth: { getSession: vi.fn(), onAuthStateChange: vi.fn() },
  from: vi.fn(),
}))
vi.mock('../../lib/supabase', () => ({ supabase: mockSupabase }))

import { isDuplicateNameError, useArchiveAccount, useArchiveCategory, useCreateAccount } from './mutations'
import { useAccounts } from '../transactions/queries'

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

describe('isDuplicateNameError', () => {
  it('is true only for a Postgres 23505 unique violation', () => {
    expect(isDuplicateNameError({ code: '23505' })).toBe(true)
    expect(isDuplicateNameError({ code: '23503' })).toBe(false)
    expect(isDuplicateNameError(new Error('nope'))).toBe(false)
    expect(isDuplicateNameError(null)).toBe(false)
  })
})

describe('archive mutations are a soft-delete, never a hard delete', () => {
  it('useArchiveAccount issues update({archived_at}) and never delete()', async () => {
    const calls: RecordedCall[] = []
    mockSupabase.from.mockImplementation(() => chainable(ok(null), (call) => calls.push(call)))

    const { result } = renderHook(() => useArchiveAccount(), { wrapper })
    await waitForAuthReady()
    await act(async () => {
      await result.current.mutateAsync('acc-1')
    })

    const update = calls.find((c) => c.method === 'update')
    expect(update).toBeTruthy()
    expect(update?.args[0]).toHaveProperty('archived_at')
    expect((update?.args[0] as { archived_at: unknown }).archived_at).toEqual(expect.any(String))
    expect(calls.some((c) => c.method === 'delete')).toBe(false)
    expect(mockSupabase.from).toHaveBeenCalledWith('accounts')
  })

  it('useArchiveCategory issues update({archived_at}) and never delete()', async () => {
    const calls: RecordedCall[] = []
    mockSupabase.from.mockImplementation(() => chainable(ok(null), (call) => calls.push(call)))

    const { result } = renderHook(() => useArchiveCategory(), { wrapper })
    await waitForAuthReady()
    await act(async () => {
      await result.current.mutateAsync('cat-1')
    })

    expect(calls.find((c) => c.method === 'update')?.args[0]).toHaveProperty('archived_at')
    expect(calls.some((c) => c.method === 'delete')).toBe(false)
    expect(mockSupabase.from).toHaveBeenCalledWith('categories')
  })
})

describe('create mutations inject the authenticated user_id (never trust input)', () => {
  it('useCreateAccount inserts with user_id from the session', async () => {
    const calls: RecordedCall[] = []
    mockSupabase.from.mockImplementation(() =>
      chainable(ok({ id: 'new', name: 'Sacco', type: 'bank', icon: null }), (call) => calls.push(call)),
    )

    const { result } = renderHook(() => useCreateAccount(), { wrapper })
    await waitForAuthReady()
    await act(async () => {
      await result.current.mutateAsync({ name: 'Sacco', type: 'bank', icon: null })
    })

    const insert = calls.find((c) => c.method === 'insert')
    expect(insert?.args[0]).toMatchObject({ name: 'Sacco', type: 'bank', user_id: USER_ID })
  })
})

describe('list queries exclude archived rows', () => {
  it('useAccounts filters archived_at is null', async () => {
    const calls: RecordedCall[] = []
    mockSupabase.from.mockImplementation(() => chainable(ok([]), (call) => calls.push(call)))

    const { result } = renderHook(() => useAccounts(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const isCall = calls.find((c) => c.method === 'is')
    expect(isCall?.args).toEqual(['archived_at', null])
  })
})
