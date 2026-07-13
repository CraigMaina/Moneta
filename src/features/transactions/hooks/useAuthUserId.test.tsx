import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { fakeAuthSession } from '../../../test/supabaseTestHelpers'

const mockSupabase = vi.hoisted(() => ({
  auth: { getSession: vi.fn(), onAuthStateChange: vi.fn() },
}))

vi.mock('../../../lib/supabase', () => ({ supabase: mockSupabase }))

import { useAuthUserId } from './useAuthUserId'

describe('useAuthUserId', () => {
  it('returns undefined until the session resolves, then the user id', async () => {
    const userId = '11111111-1111-4111-8111-111111111111'
    const session = fakeAuthSession(userId)
    mockSupabase.auth.getSession.mockImplementation(session.getSession)
    mockSupabase.auth.onAuthStateChange.mockImplementation(session.onAuthStateChange)

    const { result } = renderHook(() => useAuthUserId())

    expect(result.current).toBeUndefined()
    await waitFor(() => expect(result.current).toBe(userId))
  })

  it('returns undefined when signed out', async () => {
    const session = fakeAuthSession(undefined)
    mockSupabase.auth.getSession.mockImplementation(session.getSession)
    mockSupabase.auth.onAuthStateChange.mockImplementation(session.onAuthStateChange)

    const { result } = renderHook(() => useAuthUserId())

    await waitFor(() => expect(mockSupabase.auth.getSession).toHaveBeenCalled())
    expect(result.current).toBeUndefined()
  })

  it('unsubscribes the auth listener on unmount', async () => {
    const unsubscribe = vi.fn()
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
    mockSupabase.auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe } } })

    const { unmount } = renderHook(() => useAuthUserId())
    unmount()

    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })
})
