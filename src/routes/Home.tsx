import { useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { TZDate } from '@date-fns/tz'
import { format } from 'date-fns'
import { AmountDisplay, type AmountDisplayTone } from '../components/ui/AmountDisplay'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { ReceiptIcon } from '../components/ui/icons'
import { SafeToSpendHero } from '../components/ui/SafeToSpendHero'
import { TabBar } from '../components/ui/TabBar'
import { AddTransactionSheet } from '../features/transactions/AddTransactionSheet'
import { toNairobiDateString } from '../features/transactions/nairobiDate'
import { useAccountBalances, useCategories, useTransactions } from '../features/transactions/queries'
import type { Transaction } from '../features/transactions/types'
import { useSafeToSpend } from '../features/transactions/useSafeToSpend'
import { NAIROBI_TZ } from '../lib/safeToSpend'
import { useUiStore } from '../store/uiStore'

/**
 * Home (PRD screen 1). The safe-to-spend hero is the signature element and
 * carries the screen; balances and recent activity stay quiet around it
 * (CLAUDE.md "Signature"). The streak chip and morning-minute card are later
 * phases — omitted rather than faked, per the brief.
 */
export function Home() {
  const activeSheet = useUiStore((state) => state.activeSheet)
  const openSheet = useUiStore((state) => state.openSheet)
  const closeSheet = useUiStore((state) => state.closeSheet)

  const openAddSheet = () => openSheet('add')

  return (
    <main className="min-h-dvh bg-paper-0 pb-28">
      <div className="mx-auto max-w-md px-4 pt-[calc(env(safe-area-inset-top)+24px)]">
        <h1 className="font-display text-[22px] font-semibold text-ink-900">Moneta</h1>

        <section className="mt-6">
          <HeroSection />
        </section>

        <section className="mt-8">
          <SectionHeading>Your accounts</SectionHeading>
          <div className="mt-3">
            <BalanceCards />
          </div>
        </section>

        <section className="mt-8">
          <SectionHeading>Recent</SectionHeading>
          <div className="mt-3">
            <RecentTransactions onAdd={openAddSheet} />
          </div>
        </section>
      </div>

      <TabBar onAddPress={openAddSheet} />
      <AddTransactionSheet open={activeSheet === 'add'} onClose={closeSheet} />
    </main>
  )
}

function SectionHeading({ children }: { children: string }) {
  return <h2 className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-600">{children}</h2>
}

/** The hero: loading -> a calm skeleton ring (no spinner, no jitter), error -> a calm retry, never a scary state. */
function HeroSection() {
  const queryClient = useQueryClient()
  const { data, isLoading, isError } = useSafeToSpend()

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-[15px] text-ink-600">Couldn&apos;t work out today&apos;s number.</p>
        <Button variant="secondary" onClick={() => void queryClient.invalidateQueries()}>
          Try again
        </Button>
      </div>
    )
  }

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-2">
        <div
          className="h-[260px] w-[260px] animate-pulse rounded-full bg-paper-50 motion-reduce:animate-none"
          aria-hidden="true"
        />
      </div>
    )
  }

  return (
    <SafeToSpendHero
      safeToSpendCents={data.safeToSpendCents}
      spentTodayCents={data.spentTodayCents}
      dailyBudgetCents={data.dailyBudgetCents}
    />
  )
}

function BalanceCards() {
  const { data, isLoading, isError, refetch } = useAccountBalances()

  if (isLoading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-[84px] w-36 flex-shrink-0 animate-pulse rounded-card bg-paper-50 motion-reduce:animate-none"
            aria-hidden="true"
          />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-card bg-paper-50 px-4 py-3">
        <p className="text-[15px] text-ink-600">Couldn&apos;t load your balances.</p>
        <Button variant="secondary" onClick={() => void refetch()}>
          Retry
        </Button>
      </div>
    )
  }

  const balances = data ?? []
  if (balances.length === 0) {
    return <p className="text-[15px] text-ink-600">Your accounts will show up here once they&apos;re set up.</p>
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {balances.map((balance) => (
        <Card key={balance.account_id ?? balance.account_name} className="w-36 flex-shrink-0">
          <p className="truncate text-[12.5px] font-semibold uppercase tracking-wide text-ink-600">
            {balance.account_name ?? 'Account'}
          </p>
          <p className="mt-1">
            <AmountDisplay cents={balance.balance_cents ?? 0} size="title" />
          </p>
        </Card>
      ))}
    </div>
  )
}

function RecentTransactions({ onAdd }: { onAdd: () => void }) {
  const { data, isLoading, isError, refetch } = useTransactions({ limit: 8 })
  const categoriesQuery = useCategories()

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const category of categoriesQuery.data ?? []) map.set(category.id, category.name)
    return map
  }, [categoriesQuery.data])

  if (isLoading) {
    return (
      <Card className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-10 animate-pulse rounded-card bg-paper-50 motion-reduce:animate-none"
            aria-hidden="true"
          />
        ))}
      </Card>
    )
  }

  if (isError) {
    return (
      <Card className="flex items-center justify-between gap-3">
        <p className="text-[15px] text-ink-600">Couldn&apos;t load your transactions.</p>
        <Button variant="secondary" onClick={() => void refetch()}>
          Retry
        </Button>
      </Card>
    )
  }

  const transactions = data ?? []
  if (transactions.length === 0) {
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

  return (
    <Card className="divide-y divide-ink-300/40 p-0">
      {transactions.map((txn) => (
        <TransactionRow
          key={txn.id}
          txn={txn}
          categoryName={txn.category_id ? categoryNameById.get(txn.category_id) : undefined}
        />
      ))}
    </Card>
  )
}

/** Transfers render as a neutral row — never counted as income/expense (CLAUDE.md). */
function TransactionRow({ txn, categoryName }: { txn: Transaction; categoryName?: string }) {
  const isTransfer = txn.kind === 'transfer'
  const isIncome = txn.kind === 'income'

  const primaryLabel = txn.merchant ?? categoryName ?? (isTransfer ? 'Transfer' : isIncome ? 'Income' : 'Expense')
  const displayCents = isIncome || isTransfer ? txn.amount_cents : -txn.amount_cents
  const tone: AmountDisplayTone = isIncome ? 'income' : isTransfer ? 'default' : 'expense'

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-[15px] font-semibold text-ink-900">{primaryLabel}</p>
        <p className="mt-0.5 text-[12.5px] text-ink-600">{isTransfer ? 'Transfer' : formatDayLabel(txn.occurred_at)}</p>
      </div>
      <AmountDisplay cents={displayCents} tone={tone} signed={isIncome} size="body" />
    </div>
  )
}

function formatDayLabel(occurredAt: string): string {
  const occurred = new Date(occurredAt)
  const today = toNairobiDateString(new Date())
  const occurredDay = toNairobiDateString(occurred)
  if (occurredDay === today) return 'Today'

  const yesterday = toNairobiDateString(new Date(Date.now() - 24 * 60 * 60 * 1000))
  if (occurredDay === yesterday) return 'Yesterday'

  return format(new TZDate(occurred, NAIROBI_TZ), 'd MMM')
}
