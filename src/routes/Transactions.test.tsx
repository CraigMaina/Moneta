import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../components/ui/Toast'
import type { Account, Category, Transaction } from '../features/transactions/types'
import { useUiStore } from '../store/uiStore'
import { Transactions } from './Transactions'

const {
  useTransactionsMock,
  useAccountsMock,
  useCategoriesMock,
  useDeleteTransactionMock,
  useUpdateTransactionMock,
  useAddTransactionMock,
} = vi.hoisted(() => ({
  useTransactionsMock: vi.fn(),
  useAccountsMock: vi.fn(),
  useCategoriesMock: vi.fn(),
  useDeleteTransactionMock: vi.fn(),
  useUpdateTransactionMock: vi.fn(),
  useAddTransactionMock: vi.fn(),
}))

vi.mock('../features/transactions/queries', () => ({
  useTransactions: useTransactionsMock,
  useAccounts: useAccountsMock,
  useCategories: useCategoriesMock,
}))

vi.mock('../features/transactions/mutations', () => ({
  useDeleteTransaction: useDeleteTransactionMock,
  useUpdateTransaction: useUpdateTransactionMock,
  useAddTransaction: useAddTransactionMock,
}))

function mockMatchMedia(reducedMotion = true) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reducedMotion && query.includes('prefers-reduced-motion'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

const MPESA: Account = {
  id: 'acct-mpesa',
  user_id: 'user-1',
  name: 'M-PESA',
  type: 'mpesa',
  icon: 'smartphone',
  archived_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
}

const CASH: Account = {
  id: 'acct-cash',
  user_id: 'user-1',
  name: 'Cash',
  type: 'cash',
  icon: 'banknote',
  archived_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
}

const GROCERIES: Category = {
  id: 'cat-groceries',
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
  id: 'cat-salary',
  user_id: 'user-1',
  name: 'Salary',
  kind: 'income',
  icon: null,
  color: null,
  sort_order: 1,
  archived_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
}

function makeTxn(
  overrides: Partial<Transaction> & Pick<Transaction, 'id' | 'occurred_at' | 'kind' | 'amount_cents'>,
): Transaction {
  return {
    user_id: 'user-1',
    account_id: 'acct-mpesa',
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

// "now" is fixed to 2026-07-13T08:00:00.000Z (11:00 Nairobi) in beforeEach.
const TODAY_EXPENSE = makeTxn({
  id: 'txn-today-expense',
  occurred_at: '2026-07-13T09:00:00.000Z',
  kind: 'expense',
  amount_cents: 45000,
  merchant: 'Naivas',
  category_id: 'cat-groceries',
})
const TODAY_INCOME = makeTxn({
  id: 'txn-today-income',
  occurred_at: '2026-07-13T06:00:00.000Z',
  kind: 'income',
  amount_cents: 500000,
  merchant: 'Employer',
  category_id: 'cat-salary',
})
// 22:30 UTC on the 12th is 01:30 Nairobi on the 13th — proves the day
// boundary is computed in Nairobi, not the test runner's local/UTC day.
const LATE_UTC_TODAY_TRANSFER = makeTxn({
  id: 'txn-late-utc-transfer',
  occurred_at: '2026-07-12T22:30:00.000Z',
  kind: 'transfer',
  amount_cents: 200000,
  account_id: 'acct-mpesa',
  counter_account_id: 'acct-cash',
})
const OLD_EXPENSE = makeTxn({
  id: 'txn-old-expense',
  occurred_at: '2026-07-01T09:00:00.000Z',
  kind: 'expense',
  amount_cents: 15000,
  merchant: 'Java House',
  category_id: 'cat-groceries',
})

const ALL_TRANSACTIONS = [TODAY_EXPENSE, TODAY_INCOME, LATE_UTC_TODAY_TRANSFER, OLD_EXPENSE]

function queryResult<T>(
  data: T,
  overrides: Partial<{ isLoading: boolean; isError: boolean; isSuccess: boolean }> = {},
) {
  return {
    data,
    isLoading: false,
    isError: false,
    isSuccess: true,
    refetch: vi.fn(),
    ...overrides,
  }
}

function renderTransactions() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter>
          <Transactions />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

describe('Transactions', () => {
  beforeEach(() => {
    useUiStore.setState({ activeSheet: null })
    mockMatchMedia()
    // Freeze `Date` (for the relative day labels) without faking timers —
    // ToastProvider/Sheet rely on real `setTimeout`, and mixing that with
    // vitest's fake timers + userEvent reliably deadlocks these tests.
    vi.setSystemTime(new Date('2026-07-13T08:00:00.000Z'))
    useAccountsMock.mockReturnValue(queryResult([MPESA, CASH]))
    useCategoriesMock.mockReturnValue(queryResult([GROCERIES, SALARY]))
    useDeleteTransactionMock.mockReturnValue({ mutate: vi.fn(), isPending: false })
    useUpdateTransactionMock.mockReturnValue({ mutate: vi.fn(), isPending: false })
    useAddTransactionMock.mockReturnValue({ mutate: vi.fn(), isPending: false })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('groups rows under the correct relative Nairobi day headers, including a device-tz-independent case', () => {
    useTransactionsMock.mockReturnValue(queryResult(ALL_TRANSACTIONS))

    renderTransactions()

    // 22:30 UTC the 12th -> 01:30 Nairobi the 13th, i.e. grouped as "Today"
    // (same group as the two ordinary Nairobi-daytime transactions) even
    // though its UTC calendar date is the 12th.
    expect(screen.getByText('Today')).toBeInTheDocument()
    expect(screen.getByText('Wed 1 Jul')).toBeInTheDocument()
    expect(screen.getByText('Naivas')).toBeInTheDocument()
    expect(screen.getByText('Java House')).toBeInTheDocument()
    expect(screen.queryByText('Yesterday')).not.toBeInTheDocument()
  })

  it('narrows the list by search text combined with a kind filter chip', async () => {
    useTransactionsMock.mockReturnValue(queryResult(ALL_TRANSACTIONS))
    const user = userEvent.setup()

    renderTransactions()

    await user.click(screen.getByRole('button', { name: 'Expense' }))
    expect(screen.getByText('Naivas')).toBeInTheDocument()
    expect(screen.getByText('Java House')).toBeInTheDocument()
    expect(screen.queryByText('Employer')).not.toBeInTheDocument()

    await user.type(screen.getByRole('textbox', { name: 'Search transactions' }), 'naivas')
    expect(screen.getByText('Naivas')).toBeInTheDocument()
    expect(screen.queryByText('Java House')).not.toBeInTheDocument()
  })

  it("deleting a transaction (via its row's actions menu — the reduced-motion-safe equivalent of swipe-left) calls useDeleteTransaction with its id and shows an undo toast", async () => {
    useTransactionsMock.mockReturnValue(queryResult(ALL_TRANSACTIONS))
    const deleteMutate = vi.fn()
    useDeleteTransactionMock.mockReturnValue({ mutate: deleteMutate, isPending: false })
    const user = userEvent.setup()

    renderTransactions()

    await user.click(screen.getByRole('button', { name: 'Actions for Naivas' }))
    await user.click(await screen.findByRole('button', { name: 'Delete' }))

    expect(deleteMutate).toHaveBeenCalledWith('txn-today-expense', expect.anything())
    expect(await screen.findByText('Deleted')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument()
  })

  it('renders a transfer row neutrally — no +/- sign and not income-tinted', () => {
    useTransactionsMock.mockReturnValue(queryResult(ALL_TRANSACTIONS))

    renderTransactions()

    const row = screen.getByTestId('transaction-row-txn-late-utc-transfer')
    const amountNode = within(row).getByText(/KES/)
    expect(amountNode.textContent).not.toMatch(/^[+-]/)
    expect(amountNode.className).not.toContain('leaf-600')
  })

  it('shows a calm error state with retry when transactions fail to load', async () => {
    const refetch = vi.fn()
    useTransactionsMock.mockReturnValue({ data: undefined, isLoading: false, isError: true, isSuccess: false, refetch })
    const user = userEvent.setup()

    renderTransactions()

    expect(screen.getByText("Couldn't load your transactions.")).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(refetch).toHaveBeenCalled()
  })

  it('shows a pulsing skeleton while transactions are loading', () => {
    useTransactionsMock.mockReturnValue({ data: undefined, isLoading: true, isError: false, isSuccess: false, refetch: vi.fn() })

    renderTransactions()

    expect(screen.queryByText('No transactions yet')).not.toBeInTheDocument()
    expect(screen.queryByText("Couldn't load your transactions.")).not.toBeInTheDocument()
  })

  it('shows the teaching empty state when there are no transactions at all, and its button opens the Add sheet', async () => {
    useTransactionsMock.mockReturnValue(queryResult([]))
    const user = userEvent.setup()

    renderTransactions()

    expect(screen.getByText('No transactions yet')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add a transaction' }))
    expect(await screen.findByRole('dialog', { name: 'Add transaction' })).toBeInTheDocument()
  })

  it('shows a distinct "no matches" empty state (with a clear-filters action) when filters exclude everything', async () => {
    useTransactionsMock.mockReturnValue(queryResult(ALL_TRANSACTIONS))
    const user = userEvent.setup()

    renderTransactions()

    await user.type(screen.getByRole('textbox', { name: 'Search transactions' }), 'nonexistent-merchant')

    expect(screen.getByText('No matches')).toBeInTheDocument()
    expect(screen.queryByText('No transactions yet')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(screen.getByText('Naivas')).toBeInTheDocument()
  })
})
