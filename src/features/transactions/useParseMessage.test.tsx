import type { PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { parseMpesaMessage } from '../../parser'
import { receivedFixtures, unmatchedFixtures, type MatchedFixture } from '../../parser/__fixtures__'

const mockSupabase = vi.hoisted(() => ({ functions: { invoke: vi.fn() } }))
vi.mock('../../lib/supabase', () => ({ supabase: mockSupabase }))

import { useParseMessage } from './useParseMessage'

const MATCHED_RAW = (receivedFixtures[0] as MatchedFixture).raw
const UNMATCHED_RAW = unmatchedFixtures[0]!.raw
// A genuine ParsedMpesaMessage to stand in for what the Edge Function would return.
const sampleParsed = (() => {
  const r = parseMpesaMessage(MATCHED_RAW)
  if (r.status !== 'matched') throw new Error('setup: expected a match')
  return r.data
})()

function wrapper({ children }: PropsWithChildren) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

beforeEach(() => {
  mockSupabase.functions.invoke.mockReset()
})

describe('useParseMessage — deterministic-first, Edge fallback', () => {
  it('matches on-device without ever calling the Edge Function', async () => {
    const { result } = renderHook(() => useParseMessage(), { wrapper })
    await act(async () => {
      result.current.mutate(MATCHED_RAW)
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toMatchObject({ status: 'matched', source: 'deterministic' })
    expect(mockSupabase.functions.invoke).not.toHaveBeenCalled()
  })

  it('falls back to the Edge Function on a miss and returns an llm-sourced match', async () => {
    mockSupabase.functions.invoke.mockResolvedValue({ data: { status: 'matched', data: sampleParsed }, error: null })

    const { result } = renderHook(() => useParseMessage(), { wrapper })
    await act(async () => {
      result.current.mutate(UNMATCHED_RAW)
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toMatchObject({ status: 'matched', source: 'llm' })
    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('parse-sms', { body: { text: UNMATCHED_RAW.trim() } })
  })

  it('folds an Edge "manual" verdict to manual entry', async () => {
    mockSupabase.functions.invoke.mockResolvedValue({ data: { status: 'manual', raw: UNMATCHED_RAW }, error: null })

    const { result } = renderHook(() => useParseMessage(), { wrapper })
    await act(async () => {
      result.current.mutate(UNMATCHED_RAW)
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({ status: 'manual', raw: UNMATCHED_RAW.trim() })
  })

  it('folds an Edge error to manual entry (never surfaces a dead-end error)', async () => {
    mockSupabase.functions.invoke.mockResolvedValue({ data: null, error: { message: 'boom' } })

    const { result } = renderHook(() => useParseMessage(), { wrapper })
    await act(async () => {
      result.current.mutate(UNMATCHED_RAW)
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({ status: 'manual', raw: UNMATCHED_RAW.trim() })
  })

  it('folds an offline/thrown invoke to manual entry', async () => {
    mockSupabase.functions.invoke.mockRejectedValue(new Error('Failed to fetch'))

    const { result } = renderHook(() => useParseMessage(), { wrapper })
    await act(async () => {
      result.current.mutate(UNMATCHED_RAW)
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({ status: 'manual', raw: UNMATCHED_RAW.trim() })
  })

  it('rejects invalid Edge output rather than trusting it (zod at the boundary)', async () => {
    mockSupabase.functions.invoke.mockResolvedValue({
      data: { status: 'matched', data: { amountCents: -5, kind: 'nonsense' } },
      error: null,
    })

    const { result } = renderHook(() => useParseMessage(), { wrapper })
    await act(async () => {
      result.current.mutate(UNMATCHED_RAW)
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({ status: 'manual', raw: UNMATCHED_RAW.trim() })
  })
})
