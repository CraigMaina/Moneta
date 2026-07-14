import type { PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { chainable, fail, fakeAuthSession, ok, type RecordedCall } from '../../test/supabaseTestHelpers'
import { accountBalanceKeys, transactionKeys } from './queryKeys'
import type { AccountBalance, Transaction } from './types'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const MPESA_ID = '22222222-2222-4222-8222-222222222222'
const CASH_ID = '33333333-3333-4333-8333-333333333333'

const mockSupabase = vi.hoisted(() => ({
  auth: { getSession: vi.fn(), onAuthStateChange: vi.fn() },
  from: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({ supabase: mockSupabase }))

import {
  isOptimisticId,
  useAddTransaction,
  useDeleteTransaction,
  useSaveParsedTransactions,
  useUpdateTransaction,
} from './mutations'
import type { AddTransactionInput } from './schemas'

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

function makeClientAndWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  function wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  return { queryClient, wrapper }
}

/**
 * Every mutation hook reads `useAuthUserId`, which resolves asynchronously
 * (`supabase.auth.getSession()` is awaited in an effect). Flush that before
 * calling `mutate` in a test, or the mutation would run with `userId`
 * `undefined` and read/write the wrong (unauthenticated) query-key namespace.
 */
async function waitForAuthReady(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

const existingExpense: Transaction = {
  id: 'existing-1',
  user_id: USER_ID,
  account_id: MPESA_ID,
  counter_account_id: null,
  category_id: null,
  amount_cents: 20000,
  kind: 'expense',
  merchant: 'Java House',
  note: null,
  mpesa_ref: null,
  fee_cents: null,
  parser_version: null,
  raw_sms: null,
  source: 'manual',
  occurred_at: '2026-07-10T09:00:00.000Z',
  created_at: '2026-07-10T09:00:00.000Z',
}

const balancesSeed: AccountBalance[] = [
  { account_id: MPESA_ID, account_name: 'M-PESA', balance_cents: 100000, user_id: USER_ID },
  { account_id: CASH_ID, account_name: 'Cash', balance_cents: 5000, user_id: USER_ID },
]

describe('useAddTransaction — optimistic insert, then rollback on error', () => {
  it('optimistically inserts into the transactions list and patches account_balances, then rolls back on failure', async () => {
    const { queryClient, wrapper } = makeClientAndWrapper()

    // Seed caches the way a mounted list/balances screen would have them.
    queryClient.setQueryData(transactionKeys.list(USER_ID, {}), [existingExpense])
    queryClient.setQueryData(accountBalanceKeys.all(USER_ID), balancesSeed)

    mockSupabase.from.mockImplementation(() => chainable(fail('network unreachable'), undefined, 20))

    const { result } = renderHook(() => useAddTransaction(), { wrapper })
    await waitForAuthReady()

    await act(async () => {
      result.current.mutate({
        kind: 'expense',
        amount_cents: 15000,
        account_id: MPESA_ID,
      })
      // Let onMutate's microtasks (cancelQueries etc.) flush before asserting
      // the optimistic state, without waiting for mutationFn to settle yet.
      await Promise.resolve()
      await Promise.resolve()
    })

    const optimisticList = queryClient.getQueryData<Transaction[]>(transactionKeys.list(USER_ID, {}))
    expect(optimisticList).toHaveLength(2)
    const optimisticRow = optimisticList?.find((t) => t.id !== existingExpense.id)
    expect(optimisticRow).toBeDefined()
    expect(optimisticRow && isOptimisticId(optimisticRow.id)).toBe(true)
    expect(optimisticRow?.amount_cents).toBe(15000)
    expect(optimisticRow?.kind).toBe('expense')

    const optimisticBalances = queryClient.getQueryData<AccountBalance[]>(accountBalanceKeys.all(USER_ID))
    expect(optimisticBalances?.find((b) => b.account_id === MPESA_ID)?.balance_cents).toBe(100000 - 15000)

    // Now let the failing mutationFn settle -> rollback should fire.
    await waitFor(() => expect(result.current.isError).toBe(true))

    const rolledBackList = queryClient.getQueryData<Transaction[]>(transactionKeys.list(USER_ID, {}))
    expect(rolledBackList).toEqual([existingExpense])

    const rolledBackBalances = queryClient.getQueryData<AccountBalance[]>(accountBalanceKeys.all(USER_ID))
    expect(rolledBackBalances).toEqual(balancesSeed)
  })

  it('injects user_id from the session and never trusts caller-supplied user_id', async () => {
    const { wrapper } = makeClientAndWrapper()
    const calls: RecordedCall[] = []
    const inserted = { ...existingExpense, id: 'server-1' }
    mockSupabase.from.mockImplementation(() => chainable(ok(inserted), (call) => calls.push(call)))

    const { result } = renderHook(() => useAddTransaction(), { wrapper })
    await waitForAuthReady()

    await act(async () => {
      result.current.mutate({ kind: 'expense', amount_cents: 5000, account_id: MPESA_ID })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const insertCall = calls.find((c) => c.method === 'insert')
    expect(insertCall).toBeDefined()
    const payload = insertCall?.args[0] as { user_id: string; amount_cents: number }
    expect(payload.user_id).toBe(USER_ID)
    expect(payload.amount_cents).toBe(5000)
  })

  it('rejects a float amount_cents before ever calling Supabase', async () => {
    const { wrapper } = makeClientAndWrapper()
    const { result } = renderHook(() => useAddTransaction(), { wrapper })
    await waitForAuthReady()

    await act(async () => {
      result.current.mutate({ kind: 'expense', amount_cents: 100.5, account_id: MPESA_ID })
    })
    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(mockSupabase.from).not.toHaveBeenCalled()
  })

  it('a transfer moves balance between both accounts, never appearing as income/expense', async () => {
    const { queryClient, wrapper } = makeClientAndWrapper()
    queryClient.setQueryData(accountBalanceKeys.all(USER_ID), balancesSeed)
    mockSupabase.from.mockImplementation(() => chainable(fail('pending'), undefined, 20))

    const { result } = renderHook(() => useAddTransaction(), { wrapper })
    await waitForAuthReady()

    await act(async () => {
      result.current.mutate({
        kind: 'transfer',
        amount_cents: 20000,
        account_id: MPESA_ID,
        counter_account_id: CASH_ID,
      })
      await Promise.resolve()
      await Promise.resolve()
    })

    const balances = queryClient.getQueryData<AccountBalance[]>(accountBalanceKeys.all(USER_ID))
    expect(balances?.find((b) => b.account_id === MPESA_ID)?.balance_cents).toBe(100000 - 20000)
    expect(balances?.find((b) => b.account_id === CASH_ID)?.balance_cents).toBe(5000 + 20000)
  })
})

describe('useSaveParsedTransactions — batch save with mpesa_ref dedupe', () => {
  // A parsed agent withdrawal maps to two rows: the transfer + a separate fee expense.
  const withdrawalRows: AddTransactionInput[] = [
    {
      kind: 'transfer',
      amount_cents: 100000,
      account_id: MPESA_ID,
      counter_account_id: CASH_ID,
      mpesa_ref: 'ABC123',
      source: 'sms_parse',
      occurred_at: '2026-07-13T09:00:00.000Z',
      fee_cents: 2800,
      parser_version: 'pattern-2026.07',
      raw_sms: 'Confirmed. Withdraw Ksh1,000.00 ...',
    },
    {
      kind: 'expense',
      amount_cents: 2800,
      account_id: MPESA_ID,
      mpesa_ref: 'ABC123-FEE',
      source: 'sms_parse',
      occurred_at: '2026-07-13T09:00:00.000Z',
      note: 'Transaction fee',
    },
  ]

  it('optimistically adds BOTH rows and patches balances (transfer + fee), rolling back on error', async () => {
    const { queryClient, wrapper } = makeClientAndWrapper()
    queryClient.setQueryData(transactionKeys.list(USER_ID, {}), [])
    queryClient.setQueryData(accountBalanceKeys.all(USER_ID), balancesSeed)

    // First from() = the dedupe read (no existing refs); second = the insert (parked pending).
    mockSupabase.from
      .mockImplementationOnce(() => chainable(ok([]), undefined, 0))
      .mockImplementationOnce(() => chainable(fail('pending'), undefined, 20))

    const { result } = renderHook(() => useSaveParsedTransactions(), { wrapper })
    await waitForAuthReady()

    await act(async () => {
      result.current.mutate(withdrawalRows)
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    const optimisticList = queryClient.getQueryData<Transaction[]>(transactionKeys.list(USER_ID, {}))
    expect(optimisticList).toHaveLength(2)
    expect(optimisticList?.every((t) => isOptimisticId(t.id))).toBe(true)

    const balances = queryClient.getQueryData<AccountBalance[]>(accountBalanceKeys.all(USER_ID))
    // M-PESA: 100000 − 100000 transfer-out − 2800 fee = −2800. Cash: 5000 + 100000 = 105000.
    expect(balances?.find((b) => b.account_id === MPESA_ID)?.balance_cents).toBe(-2800)
    expect(balances?.find((b) => b.account_id === CASH_ID)?.balance_cents).toBe(105000)

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(queryClient.getQueryData<Transaction[]>(transactionKeys.list(USER_ID, {}))).toEqual([])
    expect(queryClient.getQueryData<AccountBalance[]>(accountBalanceKeys.all(USER_ID))).toEqual(balancesSeed)
  })

  it('a full re-paste is a no-op: every ref already exists → duplicated, no insert call', async () => {
    const { wrapper } = makeClientAndWrapper()
    // The dedupe read reports both refs already saved.
    mockSupabase.from.mockImplementationOnce(() =>
      chainable(ok([{ mpesa_ref: 'ABC123' }, { mpesa_ref: 'ABC123-FEE' }]), undefined, 0),
    )

    const { result } = renderHook(() => useSaveParsedTransactions(), { wrapper })
    await waitForAuthReady()

    await act(async () => {
      result.current.mutate(withdrawalRows)
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual({ inserted: [], duplicated: true })
    // Only the read happened — no insert was ever attempted.
    expect(mockSupabase.from).toHaveBeenCalledTimes(1)
  })

  it('injects user_id into every row and inserts only the not-yet-seen ones', async () => {
    const { wrapper } = makeClientAndWrapper()
    const calls: RecordedCall[] = []
    const record = (call: RecordedCall) => calls.push(call)
    // The transfer ref already exists; only the fee row is new.
    mockSupabase.from
      .mockImplementationOnce(() => chainable(ok([{ mpesa_ref: 'ABC123' }]), record))
      .mockImplementationOnce(() => chainable(ok([{ ...existingExpense, id: 'server-fee' }]), record))

    const { result } = renderHook(() => useSaveParsedTransactions(), { wrapper })
    await waitForAuthReady()

    await act(async () => {
      result.current.mutate(withdrawalRows)
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.duplicated).toBe(true)
    const insertCall = calls.find((c) => c.method === 'insert')
    const payload = insertCall?.args[0] as Array<{ user_id: string; mpesa_ref: string }>
    expect(payload).toHaveLength(1) // only the fee row (ABC123-FEE) was new
    expect(payload[0]!.mpesa_ref).toBe('ABC123-FEE')
    expect(payload[0]!.user_id).toBe(USER_ID)
  })
})

describe('useUpdateTransaction — optimistic patch with balance reversal', () => {
  it('reverses the old delta and applies the new one, rolling back both on error', async () => {
    const { queryClient, wrapper } = makeClientAndWrapper()
    queryClient.setQueryData(transactionKeys.list(USER_ID, {}), [existingExpense])
    queryClient.setQueryData(accountBalanceKeys.all(USER_ID), balancesSeed)
    mockSupabase.from.mockImplementation(() => chainable(fail('network unreachable'), undefined, 20))

    const { result } = renderHook(() => useUpdateTransaction(), { wrapper })
    await waitForAuthReady()

    await act(async () => {
      result.current.mutate({ id: existingExpense.id, patch: { amount_cents: 50000 } })
      await Promise.resolve()
      await Promise.resolve()
    })

    const optimisticBalances = queryClient.getQueryData<AccountBalance[]>(accountBalanceKeys.all(USER_ID))
    // The seeded 100,000 balance already reflects the old 20,000 expense having
    // happened. Reverse it (+20,000) then apply the new 50,000 expense (-50,000).
    expect(optimisticBalances?.find((b) => b.account_id === MPESA_ID)?.balance_cents).toBe(100000 + 20000 - 50000)

    await waitFor(() => expect(result.current.isError).toBe(true))

    const rolledBackBalances = queryClient.getQueryData<AccountBalance[]>(accountBalanceKeys.all(USER_ID))
    expect(rolledBackBalances).toEqual(balancesSeed)
    const rolledBackList = queryClient.getQueryData<Transaction[]>(transactionKeys.list(USER_ID, {}))
    expect(rolledBackList).toEqual([existingExpense])
  })
})

describe('useDeleteTransaction — optimistic removal with balance reversal', () => {
  it('removes the row and reverses its balance effect, rolling back on error', async () => {
    const { queryClient, wrapper } = makeClientAndWrapper()
    queryClient.setQueryData(transactionKeys.list(USER_ID, {}), [existingExpense])
    queryClient.setQueryData(accountBalanceKeys.all(USER_ID), balancesSeed)
    mockSupabase.from.mockImplementation(() => chainable(fail('network unreachable'), undefined, 20))

    const { result } = renderHook(() => useDeleteTransaction(), { wrapper })
    await waitForAuthReady()

    await act(async () => {
      result.current.mutate(existingExpense.id)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(queryClient.getQueryData<Transaction[]>(transactionKeys.list(USER_ID, {}))).toEqual([])
    const optimisticBalances = queryClient.getQueryData<AccountBalance[]>(accountBalanceKeys.all(USER_ID))
    expect(optimisticBalances?.find((b) => b.account_id === MPESA_ID)?.balance_cents).toBe(100000 + 20000)

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(queryClient.getQueryData<Transaction[]>(transactionKeys.list(USER_ID, {}))).toEqual([existingExpense])
    expect(queryClient.getQueryData<AccountBalance[]>(accountBalanceKeys.all(USER_ID))).toEqual(balancesSeed)
  })
})
