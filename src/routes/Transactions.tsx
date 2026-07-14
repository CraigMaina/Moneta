import { useMemo, useState } from 'react'
import { AmountDisplay } from '../components/ui/AmountDisplay'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { CloseIcon, ReceiptIcon, SearchIcon } from '../components/ui/icons'
import { Sheet } from '../components/ui/Sheet'
import { TabBar } from '../components/ui/TabBar'
import { useToast } from '../components/ui/Toast'
import { AddTransactionSheet } from '../features/transactions/AddTransactionSheet'
import { FilterChip } from '../features/transactions/FilterChip'
import { accountIcon, categoryIcon } from '../features/transactions/iconMaps'
import { useDeleteTransaction, useAddTransaction } from '../features/transactions/mutations'
import { useAccounts, useCategories, useTransactions } from '../features/transactions/queries'
import { RecategorizeSheet } from '../features/transactions/RecategorizeSheet'
import { addTransactionSchema } from '../features/transactions/schemas'
import { TransactionRow } from '../features/transactions/TransactionRow'
import { groupTransactionsByNairobiDay } from '../features/transactions/transactionGroups'
import type { Account, Category, Transaction, TransactionKind } from '../features/transactions/types'
import { useUiStore } from '../store/uiStore'

type KindFilter = 'all' | TransactionKind
type IdFilter = 'all' | string

const KIND_FILTERS: { id: KindFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'income', label: 'Income' },
  { id: 'expense', label: 'Expense' },
  { id: 'transfer', label: 'Transfer' },
]

/**
 * Transactions (PRD screen 2). Search + kind/account/category filter chips
 * narrow a day-grouped list (Nairobi calendar days, newest first). Each row
 * supports swipe-to-delete / swipe-to-recategorize with an always-available
 * "···" menu as the gesture-free, reduced-motion-safe fallback (see
 * `TransactionRow`). Money only ever renders through `AmountDisplay`.
 */
export function Transactions() {
  const activeSheet = useUiStore((state) => state.activeSheet)
  const openSheet = useUiStore((state) => state.openSheet)
  const closeSheet = useUiStore((state) => state.closeSheet)
  const openAddSheet = () => openSheet('add')

  const { showToast } = useToast()
  const transactionsQuery = useTransactions()
  const accountsQuery = useAccounts()
  const categoriesQuery = useCategories()
  const deleteTransaction = useDeleteTransaction()
  const addTransaction = useAddTransaction()

  const [search, setSearch] = useState('')
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')
  const [accountFilter, setAccountFilter] = useState<IdFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<IdFilter>('all')
  const [actionsTarget, setActionsTarget] = useState<Transaction | null>(null)
  const [recategorizeTarget, setRecategorizeTarget] = useState<Transaction | null>(null)

  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data])
  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data])
  const allTransactions = useMemo(() => transactionsQuery.data ?? [], [transactionsQuery.data])

  const accountById = useMemo(() => {
    const map = new Map<string, Account>()
    for (const account of accounts) map.set(account.id, account)
    return map
  }, [accounts])

  const categoryById = useMemo(() => {
    const map = new Map<string, Category>()
    for (const category of categories) map.set(category.id, category)
    return map
  }, [categories])

  // Categories don't apply to transfers — derived, not synced via an effect
  // (the codebase's established pattern for "keep a dependent selection
  // valid", see AddTransactionSheet/DECISIONS.md).
  const categoryFilterEffective: IdFilter = kindFilter === 'transfer' ? 'all' : categoryFilter

  const searchTerm = search.trim().toLowerCase()

  const filtered = useMemo(() => {
    return allTransactions.filter((txn) => {
      if (kindFilter !== 'all' && txn.kind !== kindFilter) return false
      if (accountFilter !== 'all' && txn.account_id !== accountFilter && txn.counter_account_id !== accountFilter) {
        return false
      }
      if (categoryFilterEffective !== 'all' && txn.category_id !== categoryFilterEffective) return false
      if (searchTerm) {
        const merchant = (txn.merchant ?? '').toLowerCase()
        const note = (txn.note ?? '').toLowerCase()
        if (!merchant.includes(searchTerm) && !note.includes(searchTerm)) return false
      }
      return true
    })
  }, [allTransactions, kindFilter, accountFilter, categoryFilterEffective, searchTerm])

  const groups = useMemo(() => groupTransactionsByNairobiDay(filtered), [filtered])

  const clearFilters = () => {
    setSearch('')
    setKindFilter('all')
    setAccountFilter('all')
    setCategoryFilter('all')
  }

  const transactionLabel = (txn: Transaction): string =>
    txn.merchant ??
    (txn.category_id ? categoryById.get(txn.category_id)?.name : undefined) ??
    (txn.kind === 'transfer' ? 'Transfer' : txn.kind === 'income' ? 'Income' : 'Expense')

  const handleDelete = (txn: Transaction) => {
    const label = transactionLabel(txn)
    deleteTransaction.mutate(txn.id, {
      onError: () => {
        showToast({
          title: "Couldn't delete that",
          description: 'Check your connection and try again.',
          variant: 'warn',
        })
      },
    })
    showToast({
      title: 'Deleted',
      description: label,
      variant: 'info',
      action: {
        label: 'Undo',
        onClick: () => {
          // Rebuild the deleted row's own fields as a fresh insert — the DB
          // has no soft-delete, so "undo" is a re-add, not a true restore
          // (a new id is assigned). `safeParse` first (rather than trusting
          // a row that was valid before deletion to stay valid) matches
          // `AddTransactionSheet`'s own defensive pattern.
          const parsed = addTransactionSchema.safeParse({
            kind: txn.kind,
            amount_cents: txn.amount_cents,
            account_id: txn.account_id,
            counter_account_id: txn.counter_account_id,
            category_id: txn.category_id,
            merchant: txn.merchant,
            note: txn.note,
            mpesa_ref: txn.mpesa_ref,
            occurred_at: txn.occurred_at,
            fee_cents: txn.fee_cents,
            source: txn.source,
          })
          if (!parsed.success) {
            showToast({ title: "Couldn't undo that", variant: 'warn' })
            return
          }
          addTransaction.mutate(parsed.data, {
            onError: () => showToast({ title: "Couldn't undo that", variant: 'warn' }),
          })
        },
      },
    })
  }

  const handleRecategorize = (txn: Transaction) => {
    setActionsTarget(null)
    setRecategorizeTarget(txn)
  }

  return (
    <main className="min-h-dvh bg-paper-0 pb-28">
      <div className="mx-auto max-w-md px-4 pt-[calc(env(safe-area-inset-top)+24px)]">
        <h1 className="font-display text-[22px] font-semibold text-ink-900">Transactions</h1>

        <div className="mt-4">
          <SearchField value={search} onChange={setSearch} />
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {KIND_FILTERS.map((option) => (
            <FilterChip
              key={option.id}
              label={option.label}
              active={kindFilter === option.id}
              onSelect={() => setKindFilter(option.id)}
            />
          ))}
        </div>

        <AccountFilterRow query={accountsQuery} accounts={accounts} value={accountFilter} onChange={setAccountFilter} />

        {kindFilter !== 'transfer' && (
          <CategoryFilterRow
            query={categoriesQuery}
            categories={categories}
            value={categoryFilterEffective}
            onChange={setCategoryFilter}
          />
        )}

        <section className="mt-5">
          <TransactionsBody
            query={transactionsQuery}
            groups={groups}
            hasAnyTransactions={allTransactions.length > 0}
            onClearFilters={clearFilters}
            onAdd={openAddSheet}
            accountById={accountById}
            categoryById={categoryById}
            onDelete={handleDelete}
            onRecategorize={handleRecategorize}
            onOpenActions={setActionsTarget}
          />
        </section>
      </div>

      <TabBar onAddPress={openAddSheet} />
      <AddTransactionSheet open={activeSheet === 'add'} onClose={closeSheet} />

      <RowActionsSheet
        transaction={actionsTarget}
        onClose={() => setActionsTarget(null)}
        onDelete={(txn) => {
          setActionsTarget(null)
          handleDelete(txn)
        }}
        onRecategorize={handleRecategorize}
      />
      <RecategorizeSheet transaction={recategorizeTarget} onClose={() => setRecategorizeTarget(null)} />
    </main>
  )
}

function SearchField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="relative">
      <SearchIcon
        className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-600"
        aria-hidden="true"
      />
      <input
        type="text"
        inputMode="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search by merchant or note"
        aria-label="Search transactions"
        className="h-12 w-full rounded-card bg-paper-50 pl-11 pr-11 text-[15px] text-ink-900 placeholder:text-ink-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600 focus-visible:ring-offset-2 focus-visible:ring-offset-paper-0"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="absolute right-0.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-ink-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600 focus-visible:ring-offset-2 focus-visible:ring-offset-paper-50"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

interface FilterRowQueryState {
  isLoading: boolean
  isError: boolean
  refetch: () => void
}

function FilterChipSkeleton() {
  return (
    <div className="mt-3 flex gap-2">
      {[0, 1].map((i) => (
        <div key={i} className="h-11 w-24 flex-shrink-0 animate-pulse rounded-full bg-paper-50 motion-reduce:animate-none" />
      ))}
    </div>
  )
}

function FilterRowRetry({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mt-3 flex items-center justify-between gap-3 rounded-card bg-paper-50 px-4 py-2.5">
      <p className="text-[12.5px] text-ink-600">{message}</p>
      <Button variant="ghost" size="md" onClick={onRetry}>
        Retry
      </Button>
    </div>
  )
}

function AccountFilterRow({
  query,
  accounts,
  value,
  onChange,
}: {
  query: FilterRowQueryState
  accounts: Account[]
  value: IdFilter
  onChange: (value: IdFilter) => void
}) {
  if (query.isLoading) return <FilterChipSkeleton />
  if (query.isError) return <FilterRowRetry message="Couldn't load accounts." onRetry={query.refetch} />
  if (accounts.length === 0) return null

  return (
    <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
      <FilterChip label="All accounts" active={value === 'all'} onSelect={() => onChange('all')} />
      {accounts.map((account) => (
        <FilterChip
          key={account.id}
          label={account.name}
          icon={accountIcon(account)}
          active={value === account.id}
          onSelect={() => onChange(account.id)}
        />
      ))}
    </div>
  )
}

function CategoryFilterRow({
  query,
  categories,
  value,
  onChange,
}: {
  query: FilterRowQueryState
  categories: Category[]
  value: IdFilter
  onChange: (value: IdFilter) => void
}) {
  if (query.isLoading) return <FilterChipSkeleton />
  if (query.isError) return <FilterRowRetry message="Couldn't load categories." onRetry={query.refetch} />
  if (categories.length === 0) return null

  return (
    <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
      <FilterChip label="All categories" active={value === 'all'} onSelect={() => onChange('all')} />
      {categories.map((category) => (
        <FilterChip
          key={category.id}
          label={category.name}
          icon={categoryIcon(category)}
          active={value === category.id}
          onSelect={() => onChange(category.id)}
        />
      ))}
    </div>
  )
}

interface TransactionsQueryState {
  isLoading: boolean
  isError: boolean
  refetch: () => void
}

function TransactionsBody({
  query,
  groups,
  hasAnyTransactions,
  onClearFilters,
  onAdd,
  accountById,
  categoryById,
  onDelete,
  onRecategorize,
  onOpenActions,
}: {
  query: TransactionsQueryState
  groups: ReturnType<typeof groupTransactionsByNairobiDay>
  hasAnyTransactions: boolean
  onClearFilters: () => void
  onAdd: () => void
  accountById: Map<string, Account>
  categoryById: Map<string, Category>
  onDelete: (txn: Transaction) => void
  onRecategorize: (txn: Transaction) => void
  onOpenActions: (txn: Transaction) => void
}) {
  if (query.isLoading) {
    return (
      <Card className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded-card bg-paper-50 motion-reduce:animate-none" aria-hidden="true" />
        ))}
      </Card>
    )
  }

  if (query.isError) {
    return (
      <Card className="flex items-center justify-between gap-3">
        <p className="text-[15px] text-ink-600">Couldn&apos;t load your transactions.</p>
        <Button variant="secondary" onClick={() => query.refetch()}>
          Retry
        </Button>
      </Card>
    )
  }

  if (!hasAnyTransactions) {
    return (
      <Card className="p-0">
        <EmptyState
          icon={<ReceiptIcon />}
          title="No transactions yet"
          description="Paste an M-PESA message or log one manually to see it here."
          actionLabel="Add a transaction"
          onAction={onAdd}
        />
      </Card>
    )
  }

  if (groups.length === 0) {
    return (
      <Card className="p-0">
        <EmptyState
          icon={<SearchIcon />}
          title="No matches"
          description="Nothing matches your search or filters. Clear them to see everything."
          actionLabel="Clear filters"
          onAction={onClearFilters}
        />
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.dayKey}>
          <h2 className="px-1 text-[12.5px] font-semibold uppercase tracking-wide text-ink-600">{group.label}</h2>
          <Card className="mt-2 divide-y divide-ink-300/40 p-0">
            {group.transactions.map((txn) => (
              <TransactionRow
                key={txn.id}
                txn={txn}
                category={txn.category_id ? categoryById.get(txn.category_id) : undefined}
                account={accountById.get(txn.account_id)}
                onDelete={onDelete}
                onRecategorize={onRecategorize}
                onOpenActions={onOpenActions}
              />
            ))}
          </Card>
        </div>
      ))}
    </div>
  )
}

/** The always-available, gesture-free fallback for a row's swipe actions (see `TransactionRow`). */
function RowActionsSheet({
  transaction,
  onClose,
  onDelete,
  onRecategorize,
}: {
  transaction: Transaction | null
  onClose: () => void
  onDelete: (txn: Transaction) => void
  onRecategorize: (txn: Transaction) => void
}) {
  return (
    <Sheet open={transaction !== null} onClose={onClose} title="Transaction">
      {transaction && (
        <div className="space-y-3">
          <p className="flex items-baseline gap-2 text-[15px] text-ink-600">
            <AmountDisplay
              cents={transaction.kind === 'expense' ? -transaction.amount_cents : transaction.amount_cents}
              tone={transaction.kind === 'income' ? 'income' : transaction.kind === 'transfer' ? 'default' : 'expense'}
              signed={transaction.kind === 'income'}
              size="title"
            />
            <span>{transaction.merchant ?? (transaction.kind === 'transfer' ? 'Transfer' : transaction.kind === 'income' ? 'Income' : 'Expense')}</span>
          </p>
          {transaction.kind !== 'transfer' && (
            <Button variant="secondary" fullWidth onClick={() => onRecategorize(transaction)}>
              Recategorize
            </Button>
          )}
          <Button variant="secondary" fullWidth onClick={() => onDelete(transaction)}>
            Delete
          </Button>
        </div>
      )}
    </Sheet>
  )
}
