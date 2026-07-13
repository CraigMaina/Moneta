import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../components/ui/Toast'
import { Home } from './Home'
import { useUiStore } from '../store/uiStore'
import type { Account, AccountBalance, Category, Transaction } from '../features/transactions/types'

const {
  useSafeToSpendMock,
  useAccountBalancesMock,
  useTransactionsMock,
  useCategoriesMock,
  useAccountsMock,
  useAddTransactionMock,
} = vi.hoisted(() => ({
  useSafeToSpendMock: vi.fn(),
  useAccountBalancesMock: vi.fn(),
  useTransactionsMock: vi.fn(),
  useCategoriesMock: vi.fn(),
  useAccountsMock: vi.fn(),
  useAddTransactionMock: vi.fn(),
}))

vi.mock('../features/transactions/useSafeToSpend', () => ({
  useSafeToSpend: useSafeToSpendMock,
}))

vi.mock('../features/transactions/queries', () => ({
  useAccountBalances: useAccountBalancesMock,
  useTransactions: useTransactionsMock,
  useCategories: useCategoriesMock,
  useAccounts: useAccountsMock,
}))

vi.mock('../features/transactions/mutations', () => ({
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

const BALANCES: AccountBalance[] = [
  { account_id: 'acct-mpesa', account_name: 'M-PESA', balance_cents: 340000, user_id: 'user-1' },
  { account_id: 'acct-cash', account_name: 'Cash', balance_cents: 50000, user_id: 'user-1' },
]

const TRANSACTIONS: Transaction[] = [
  {
    id: 'txn-1',
    user_id: 'user-1',
    account_id: 'acct-mpesa',
    counter_account_id: null,
    category_id: 'cat-groceries',
    amount_cents: 45000,
    kind: 'expense',
    merchant: 'Naivas',
    note: null,
    mpesa_ref: null,
    fee_cents: null,
    parser_version: null,
    raw_sms: null,
    source: 'manual',
    occurred_at: '2026-07-13T09:00:00.000Z',
    created_at: '2026-07-13T09:00:00.000Z',
  },
]

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

function renderHome() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter>
          <Home />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

describe('Home', () => {
  beforeEach(() => {
    useUiStore.setState({ activeSheet: null })
    mockMatchMedia()
    useAccountsMock.mockReturnValue(queryResult([MPESA, CASH]))
    useCategoriesMock.mockReturnValue(queryResult([GROCERIES]))
    useAccountBalancesMock.mockReturnValue(queryResult(BALANCES))
    useAddTransactionMock.mockReturnValue({ mutate: vi.fn(), isPending: false })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the safe-to-spend hero from useSafeToSpend and the account balances', () => {
    useSafeToSpendMock.mockReturnValue({
      data: { safeToSpendCents: 140000, spentTodayCents: 20000, dailyBudgetCents: 50000, isOver: false },
      isLoading: false,
      isError: false,
    })
    useTransactionsMock.mockReturnValue(queryResult(TRANSACTIONS))

    renderHome()

    expect(screen.getByText('Safe to spend today')).toBeInTheDocument()
    expect(screen.getByText('1,400')).toBeInTheDocument()
    expect(screen.getByText('M-PESA')).toBeInTheDocument()
    expect(screen.getByText('Naivas')).toBeInTheDocument()
  })

  it('shows a calm retry when the safe-to-spend calc errors, never a scary state', () => {
    useSafeToSpendMock.mockReturnValue({ data: undefined, isLoading: false, isError: true })
    useTransactionsMock.mockReturnValue(queryResult(TRANSACTIONS))

    renderHome()

    expect(screen.getByText("Couldn't work out today's number.")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('shows the empty state when there are no transactions, and its button opens the Add sheet', async () => {
    useSafeToSpendMock.mockReturnValue({
      data: { safeToSpendCents: 140000, spentTodayCents: 20000, dailyBudgetCents: 50000, isOver: false },
      isLoading: false,
      isError: false,
    })
    useTransactionsMock.mockReturnValue(queryResult([]))
    const user = userEvent.setup()

    renderHome()

    expect(screen.getByText('No transactions yet')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Add a transaction' }))

    expect(await screen.findByRole('dialog', { name: 'Add transaction' })).toBeInTheDocument()
  })

  it("the TabBar's Add button also opens the Add sheet", async () => {
    useSafeToSpendMock.mockReturnValue({
      data: { safeToSpendCents: 140000, spentTodayCents: 20000, dailyBudgetCents: 50000, isOver: false },
      isLoading: false,
      isError: false,
    })
    useTransactionsMock.mockReturnValue(queryResult(TRANSACTIONS))
    const user = userEvent.setup()

    renderHome()

    await user.click(screen.getByRole('button', { name: 'Add transaction' }))

    expect(await screen.findByRole('dialog', { name: 'Add transaction' })).toBeInTheDocument()
  })
})
