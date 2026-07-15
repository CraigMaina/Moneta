import type { PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { chainable, fakeAuthSession, ok, type RecordedCall } from '../../test/supabaseTestHelpers'

const USER_ID = '11111111-1111-4111-8111-111111111111'

const mockSupabase = vi.hoisted(() => ({
  auth: { getSession: vi.fn(), onAuthStateChange: vi.fn() },
  from: vi.fn(),
}))
vi.mock('../../lib/supabase', () => ({ supabase: mockSupabase }))

import { useContributeToGoal } from './mutations'

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

describe('useContributeToGoal', () => {
  it('stamps achieved_at and reports justReached when a contribution reaches the target', async () => {
    const calls: { table: string; recorded: RecordedCall[] }[] = []
    const makeFrom = (table: string, result: unknown) => {
      const recorded: RecordedCall[] = []
      calls.push({ table, recorded })
      return chainable({ data: result, error: null } as never, (c) => recorded.push(c))
    }
    mockSupabase.from
      .mockReturnValueOnce(makeFrom('goal_contributions', null)) // insert
      .mockReturnValueOnce(makeFrom('goal_contributions', [{ amount_cents: 6000 }, { amount_cents: 4000 }])) // sum → 10000
      .mockReturnValueOnce(makeFrom('goals', null)) // achieve update

    const { result } = renderHook(() => useContributeToGoal(), { wrapper })
    await waitForAuthReady()
    let outcome: { justReached: boolean } | undefined
    await act(async () => {
      outcome = await result.current.mutateAsync({
        goalId: 'g1',
        amountCents: 4000,
        targetCents: 10000,
        alreadyAchieved: false,
      })
    })

    expect(outcome).toEqual({ justReached: true })
    // The third call updates goals with an achieved_at timestamp.
    const goalsUpdate = calls[2]?.recorded.find((c) => c.method === 'update')
    expect(goalsUpdate?.args[0]).toHaveProperty('achieved_at')
  })

  it('does not stamp or celebrate when still short of target', async () => {
    mockSupabase.from
      .mockReturnValueOnce(chainable(ok(null))) // insert
      .mockReturnValueOnce(chainable(ok([{ amount_cents: 5000 }]))) // sum → 5000 < 10000

    const { result } = renderHook(() => useContributeToGoal(), { wrapper })
    await waitForAuthReady()
    let outcome: { justReached: boolean } | undefined
    await act(async () => {
      outcome = await result.current.mutateAsync({ goalId: 'g1', amountCents: 5000, targetCents: 10000, alreadyAchieved: false })
    })

    expect(outcome).toEqual({ justReached: false })
    expect(mockSupabase.from).toHaveBeenCalledTimes(2) // no goals update
  })

  it('never re-celebrates an already-achieved goal', async () => {
    mockSupabase.from
      .mockReturnValueOnce(chainable(ok(null))) // insert
      .mockReturnValueOnce(chainable(ok([{ amount_cents: 20000 }]))) // over target

    const { result } = renderHook(() => useContributeToGoal(), { wrapper })
    await waitForAuthReady()
    let outcome: { justReached: boolean } | undefined
    await act(async () => {
      outcome = await result.current.mutateAsync({ goalId: 'g1', amountCents: 5000, targetCents: 10000, alreadyAchieved: true })
    })

    expect(outcome).toEqual({ justReached: false })
    expect(mockSupabase.from).toHaveBeenCalledTimes(2) // insert + sum only, no re-stamp
  })
})
