import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../components/ui/Toast'
import { AddTransactionSheet } from './AddTransactionSheet'
import type { Account, Category } from './types'

const { useAccountsMock, useCategoriesMock } = vi.hoisted(() => ({
  useAccountsMock: vi.fn(),
  useCategoriesMock: vi.fn(),
}))
const { useAddTransactionMock } = vi.hoisted(() => ({ useAddTransactionMock: vi.fn() }))

vi.mock('./queries', () => ({
  useAccounts: useAccountsMock,
  useCategories: useCategoriesMock,
}))

vi.mock('./mutations', () => ({
  useAddTransaction: useAddTransactionMock,
}))

function mockMatchMedia() {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

// Zod's `.uuid()` checks the RFC 4122 version/variant nibbles, not just the
// shape — these fixture ids use a valid version (4) and variant (8) so they
// pass `addTransactionSchema` exactly like a real Postgres-generated id would.
const MPESA_ID = '11111111-1111-4111-8111-111111111111'
const CASH_ID = '22222222-2222-4222-8222-222222222222'
const GROCERIES_ID = '33333333-3333-4333-8333-333333333333'
const SALARY_ID = '44444444-4444-4444-8444-444444444444'

const MPESA: Account = {
  id: MPESA_ID,
  user_id: 'user-1',
  name: 'M-PESA',
  type: 'mpesa',
  icon: 'smartphone',
  archived_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
}

const CASH: Account = {
  id: CASH_ID,
  user_id: 'user-1',
  name: 'Cash',
  type: 'cash',
  icon: 'banknote',
  archived_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
}

const GROCERIES: Category = {
  id: GROCERIES_ID,
  user_id: 'user-1',
  name: 'Groceries',
  kind: 'expense',
  icon: 'shopping-basket',
  color: '#E8474B',
  sort_order: 1,
  archived_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
}

const SALARY: Category = {
  id: SALARY_ID,
  user_id: 'user-1',
  name: 'Salary',
  kind: 'income',
  icon: 'wallet',
  color: '#1F8A5D',
  sort_order: 1,
  archived_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
}

function queryResult<T>(data: T, overrides: Partial<{ isLoading: boolean; isError: boolean; isSuccess: boolean }> = {}) {
  return {
    data,
    isLoading: false,
    isError: false,
    isSuccess: true,
    refetch: vi.fn(),
    ...overrides,
  }
}

function renderSheet(onClose = vi.fn()) {
  return render(
    <ToastProvider>
      <AddTransactionSheet open onClose={onClose} />
    </ToastProvider>,
  )
}

async function enterAmount(user: ReturnType<typeof userEvent.setup>, digits: string) {
  for (const digit of digits) {
    await user.click(screen.getByRole('button', { name: `Digit ${digit}` }))
  }
}

describe('AddTransactionSheet', () => {
  beforeEach(() => {
    mockMatchMedia()
    useAccountsMock.mockReturnValue(queryResult([MPESA, CASH]))
    useCategoriesMock.mockReturnValue(queryResult([GROCERIES, SALARY]))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('add-expense happy path: amount -> category -> Log it calls mutate with correct integer-cents input', async () => {
    const mutate = vi.fn((_input, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.())
    useAddTransactionMock.mockReturnValue({ mutate, isPending: false })
    const onClose = vi.fn()
    const user = userEvent.setup()

    renderSheet(onClose)

    await enterAmount(user, '500')
    await user.click(screen.getByRole('button', { name: 'Groceries' }))
    await user.click(screen.getByRole('button', { name: 'Log it' }))

    expect(mutate).toHaveBeenCalledTimes(1)
    const [input] = mutate.mock.calls.at(0)!
    expect(input).toMatchObject({
      kind: 'expense',
      amount_cents: 50000,
      account_id: MPESA_ID,
      category_id: GROCERIES_ID,
      counter_account_id: null,
    })
    expect(Number.isInteger(input.amount_cents)).toBe(true)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('Logged')).toBeInTheDocument()
  })

  it('transfer correctness: switching to Transfer hides category, requires a distinct counter-account, and builds kind:transfer with category_id null', async () => {
    const mutate = vi.fn((_input, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.())
    useAddTransactionMock.mockReturnValue({ mutate, isPending: false })
    const user = userEvent.setup()

    renderSheet()

    await user.click(screen.getByRole('button', { name: 'Transfer' }))

    // Category picker disappears entirely for a transfer.
    expect(screen.queryByText('Category')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Groceries' })).not.toBeInTheDocument()

    // Both a source ("From") and a distinct counter ("To") account are shown.
    expect(screen.getByText('From')).toBeInTheDocument()
    expect(screen.getByText('To')).toBeInTheDocument()

    await enterAmount(user, '200')
    await user.click(screen.getByRole('button', { name: 'Log it' }))

    expect(mutate).toHaveBeenCalledTimes(1)
    const [input] = mutate.mock.calls.at(0)!
    expect(input.kind).toBe('transfer')
    expect(input.category_id).toBeNull()
    expect(input.counter_account_id).not.toBeNull()
    expect(input.counter_account_id).not.toBe(input.account_id)
  })

  it('a mutation failure shows a non-shaming toast and keeps the sheet open', async () => {
    const mutate = vi.fn((_input, opts?: { onError?: (err: Error) => void }) => opts?.onError?.(new Error('network down')))
    useAddTransactionMock.mockReturnValue({ mutate, isPending: false })
    const onClose = vi.fn()
    const user = userEvent.setup()

    renderSheet(onClose)

    await enterAmount(user, '500')
    await user.click(screen.getByRole('button', { name: 'Log it' }))

    expect(await screen.findByText("Couldn't log that")).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('disables Log it until an amount is entered', () => {
    useAddTransactionMock.mockReturnValue({ mutate: vi.fn(), isPending: false })
    renderSheet()
    expect(screen.getByRole('button', { name: 'Log it' })).toBeDisabled()
  })

  it('shows a calm retry when categories fail to load', () => {
    useAddTransactionMock.mockReturnValue({ mutate: vi.fn(), isPending: false })
    useCategoriesMock.mockReturnValue(queryResult(undefined, { isLoading: false, isError: true, isSuccess: false }))
    renderSheet()
    expect(screen.getByText("Couldn't load categories.")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })
})
