import { useMemo, useState } from 'react'
import { TZDate } from '@date-fns/tz'
import { AmountDisplay } from '../components/ui/AmountDisplay'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Sheet } from '../components/ui/Sheet'
import { TabBar } from '../components/ui/TabBar'
import { ChevronRightIcon, InsightsIcon } from '../components/ui/icons'
import { AddTransactionSheet } from '../features/transactions/AddTransactionSheet'
import { categoryIcon } from '../features/transactions/iconMaps'
import { toNairobiDateString } from '../features/transactions/nairobiDate'
import { useCategories, useTransactions } from '../features/transactions/queries'
import type { Category, Transaction } from '../features/transactions/types'
import { CategoryDonut, type DonutSlice } from '../features/insights/CategoryDonut'
import { MonthlyTrendChart } from '../features/insights/MonthlyTrendChart'
import {
  OTHER_SLICE_ID,
  monthInsights,
  monthKeyLabel,
  monthlySeries,
  nairobiMonthKey,
  recentMonthKeys,
  withOtherBucket,
} from '../features/insights/insightsMath'
import { NAIROBI_TZ } from '../lib/safeToSpend'
import { cn } from '../lib/cn'
import { useUiStore } from '../store/uiStore'

/**
 * Insights (PRD F10 / screen 6). All charts render from local data and work
 * offline. Transfers are excluded everywhere (that's `insightsMath`'s job).
 * The month shown is driven by the trend chart (tap a month) and the ‹ › nav.
 */

const MONTH_WINDOW = 6
// The category the parser books M-PESA/Fuliza fees to (see buildParsedRows).
const FEE_CATEGORY_NAME = 'Fees & Fuliza charges'
const UNCATEGORIZED_ID = '__uncategorized__'

/** First instant of a `yyyy-MM` month, in Africa/Nairobi (for the query lower bound). */
function monthStartDate(monthKey: string): Date {
  const parts = monthKey.split('-')
  const year = Number(parts[0])
  const month = Number(parts[1])
  return new TZDate(year, month - 1, 1, 0, 0, 0, 0, NAIROBI_TZ)
}

export function Insights() {
  const activeSheet = useUiStore((s) => s.activeSheet)
  const openSheet = useUiStore((s) => s.openSheet)
  const closeSheet = useUiStore((s) => s.closeSheet)
  const openAddSheet = () => openSheet('add')

  const now = useMemo(() => new Date(), [])
  const months = useMemo(() => recentMonthKeys(now, MONTH_WINDOW), [now])
  const currentMonth = nairobiMonthKey(now.toISOString())
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  // 'closed' = sheet shut; otherwise the drilled category id (or null = uncategorized).
  const [drillCategoryId, setDrillCategoryId] = useState<string | null | 'closed'>('closed')

  const from = useMemo(() => monthStartDate(months[0] ?? currentMonth), [months, currentMonth])
  const transactionsQuery = useTransactions({ from })
  const categoriesQuery = useCategories()

  const txns = useMemo(() => transactionsQuery.data ?? [], [transactionsQuery.data])
  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data])
  const categoryById = useMemo(() => {
    const map = new Map<string, Category>()
    for (const c of categories) map.set(c.id, c)
    return map
  }, [categories])
  const feeCategoryId = useMemo(
    () => categories.find((c) => c.name === FEE_CATEGORY_NAME)?.id ?? null,
    [categories],
  )

  const monthData = useMemo(
    () => monthInsights(txns, selectedMonth, { feeCategoryId }),
    [txns, selectedMonth, feeCategoryId],
  )
  const series = useMemo(() => monthlySeries(txns, months), [txns, months])

  const donutSlices: DonutSlice[] = useMemo(
    () =>
      withOtherBucket(monthData.byCategory, 5).map((slice) => {
        if (slice.categoryId === OTHER_SLICE_ID) {
          return { id: OTHER_SLICE_ID, label: 'Other', amountCents: slice.amountCents }
        }
        if (slice.categoryId === null) {
          return { id: UNCATEGORIZED_ID, label: 'Uncategorized', amountCents: slice.amountCents }
        }
        const category = categoryById.get(slice.categoryId)
        return {
          id: slice.categoryId,
          label: category?.name ?? 'Category',
          amountCents: slice.amountCents,
          icon: category ? categoryIcon(category) : undefined,
        }
      }),
    [monthData.byCategory, categoryById],
  )

  const selectedIndex = months.indexOf(selectedMonth)
  const goPrev = () => {
    const prev = months[selectedIndex - 1]
    if (prev) setSelectedMonth(prev)
  }
  const goNext = () => {
    const next = months[selectedIndex + 1]
    if (next) setSelectedMonth(next)
  }

  const openDrill = (sliceId: string) => {
    if (sliceId === OTHER_SLICE_ID) return
    setDrillCategoryId(sliceId === UNCATEGORIZED_ID ? null : sliceId)
  }
  const drillCategory = typeof drillCategoryId === 'string' ? categoryById.get(drillCategoryId) : undefined
  const drillTransactions = useMemo(() => {
    if (drillCategoryId === 'closed') return []
    return txns.filter(
      (t) =>
        t.kind === 'expense' &&
        nairobiMonthKey(t.occurred_at) === selectedMonth &&
        (t.category_id ?? null) === drillCategoryId,
    )
  }, [txns, drillCategoryId, selectedMonth])

  return (
    <main className="min-h-dvh bg-paper-0 pb-28">
      <div className="mx-auto max-w-md px-4 pt-[calc(env(safe-area-inset-top)+24px)]">
        <h1 className="font-display text-[22px] font-semibold text-ink-900">Insights</h1>

        <MonthNav
          label={monthKeyLabel(selectedMonth)}
          onPrev={goPrev}
          onNext={goNext}
          canPrev={selectedIndex > 0}
          canNext={selectedIndex < months.length - 1}
        />

        <InsightsBody
          query={transactionsQuery}
          hasAnyData={txns.length > 0}
          monthData={monthData}
          series={series}
          selectedMonth={selectedMonth}
          onSelectMonth={setSelectedMonth}
          donutSlices={donutSlices}
          onDrill={openDrill}
          onAdd={openAddSheet}
        />
      </div>

      <TabBar onAddPress={openAddSheet} />
      <AddTransactionSheet open={activeSheet === 'add'} onClose={closeSheet} />

      <CategoryDrillSheet
        open={drillCategoryId !== 'closed'}
        onClose={() => setDrillCategoryId('closed')}
        title={drillCategory?.name ?? (drillCategoryId === null ? 'Uncategorized' : 'Category')}
        monthLabel={monthKeyLabel(selectedMonth)}
        transactions={drillTransactions}
      />
    </main>
  )
}

function MonthNav({
  label,
  onPrev,
  onNext,
  canPrev,
  canNext,
}: {
  label: string
  onPrev: () => void
  onNext: () => void
  canPrev: boolean
  canNext: boolean
}) {
  return (
    <div className="mt-4 flex items-center justify-between">
      <NavArrow direction="prev" onClick={onPrev} disabled={!canPrev} />
      <span className="text-[15px] font-semibold text-ink-900">{label}</span>
      <NavArrow direction="next" onClick={onNext} disabled={!canNext} />
    </div>
  )
}

function NavArrow({ direction, onClick, disabled }: { direction: 'prev' | 'next'; onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === 'prev' ? 'Previous month' : 'Next month'}
      className="flex h-10 w-10 items-center justify-center rounded-full text-ink-600 hover:bg-paper-50 hover:text-ink-900 disabled:opacity-30 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600"
    >
      <ChevronRightIcon className={cn('h-5 w-5', direction === 'prev' && 'rotate-180')} />
    </button>
  )
}

interface InsightsBodyProps {
  query: { isPending: boolean; isError: boolean; refetch: () => void }
  hasAnyData: boolean
  monthData: ReturnType<typeof monthInsights>
  series: ReturnType<typeof monthlySeries>
  selectedMonth: string
  onSelectMonth: (monthKey: string) => void
  donutSlices: DonutSlice[]
  onDrill: (sliceId: string) => void
  onAdd: () => void
}

function InsightsBody({
  query,
  hasAnyData,
  monthData,
  series,
  selectedMonth,
  onSelectMonth,
  donutSlices,
  onDrill,
  onAdd,
}: InsightsBodyProps) {
  if (query.isPending) {
    return (
      <div className="mt-5 space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-card bg-paper-50 motion-reduce:animate-none" aria-hidden="true" />
        ))}
      </div>
    )
  }

  if (query.isError) {
    return (
      <Card className="mt-5 flex items-center justify-between gap-3">
        <p className="text-[15px] text-ink-600">Couldn&apos;t load your insights.</p>
        <Button variant="secondary" onClick={() => query.refetch()}>
          Retry
        </Button>
      </Card>
    )
  }

  if (!hasAnyData) {
    return (
      <Card className="mt-5 p-0">
        <EmptyState
          icon={<InsightsIcon />}
          title="Nothing to chart yet"
          description="Paste an M-PESA message or log a transaction, and your money picture builds here."
          actionLabel="Add a transaction"
          onAction={onAdd}
        />
      </Card>
    )
  }

  const monthEmpty = monthData.incomeCents === 0 && monthData.expenseCents === 0

  return (
    <div className="mt-5 space-y-4">
      <CashFlowCard monthData={monthData} />

      <Card>
        <h2 className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-600">Trend</h2>
        <div className="mt-4">
          <MonthlyTrendChart data={series} selectedMonthKey={selectedMonth} onSelectMonth={onSelectMonth} />
        </div>
      </Card>

      <Card>
        <h2 className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-600">Where it went</h2>
        {monthEmpty || donutSlices.length === 0 ? (
          <p className="mt-3 text-[15px] text-ink-600">No spending this month.</p>
        ) : (
          <div className="mt-4">
            <CategoryDonut slices={donutSlices} onSelect={onDrill} nonInteractiveIds={new Set([OTHER_SLICE_ID])} />
          </div>
        )}
      </Card>

      <FeesSpotlight feesCents={monthData.feesCents} expenseCents={monthData.expenseCents} />
    </div>
  )
}

function CashFlowCard({ monthData }: { monthData: ReturnType<typeof monthInsights> }) {
  const { incomeCents, expenseCents, netCents } = monthData
  const max = Math.max(incomeCents, expenseCents, 1)
  return (
    <Card>
      <h2 className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-600">Cash flow</h2>
      <div className="mt-3 space-y-3">
        <FlowRow label="In" cents={incomeCents} tone="income" widthPct={(incomeCents / max) * 100} barClass="bg-leaf-600" />
        <FlowRow label="Out" cents={expenseCents} tone="expense" widthPct={(expenseCents / max) * 100} barClass="bg-coral-600" />
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-ink-300/40 pt-3">
        <span className="text-[15px] font-semibold text-ink-900">Net</span>
        <AmountDisplay cents={netCents} tone={netCents >= 0 ? 'income' : 'expense'} signed size="title" />
      </div>
    </Card>
  )
}

function FlowRow({
  label,
  cents,
  tone,
  widthPct,
  barClass,
}: {
  label: string
  cents: number
  tone: 'income' | 'expense'
  widthPct: number
  barClass: string
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-[15px] text-ink-600">{label}</span>
        <AmountDisplay cents={tone === 'expense' ? -cents : cents} tone={tone} signed size="body" />
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-paper-50">
        <div className={cn('h-full rounded-full', barClass)} style={{ width: `${Math.max(widthPct, cents > 0 ? 4 : 0)}%` }} />
      </div>
    </div>
  )
}

function FeesSpotlight({ feesCents, expenseCents }: { feesCents: number; expenseCents: number }) {
  const pct = expenseCents > 0 ? Math.round((feesCents / expenseCents) * 100) : 0
  return (
    <Card>
      <h2 className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-600">Fees &amp; Fuliza</h2>
      {feesCents > 0 ? (
        <>
          <p className="mt-2">
            <AmountDisplay cents={-feesCents} tone="expense" size="title" />
          </p>
          <p className="mt-1 text-[15px] text-ink-600">
            Transaction and Fuliza charges this month{pct > 0 ? ` — ${pct}% of your spending` : ''}.
          </p>
        </>
      ) : (
        <p className="mt-2 text-[15px] text-ink-600">No fees this month. Nice.</p>
      )}
    </Card>
  )
}

function CategoryDrillSheet({
  open,
  onClose,
  title,
  monthLabel,
  transactions,
}: {
  open: boolean
  onClose: () => void
  title: string
  monthLabel: string
  transactions: Transaction[]
}) {
  const total = transactions.reduce((sum, t) => sum + t.amount_cents, 0)
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        <div className="flex items-baseline justify-between">
          <span className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-600">{monthLabel}</span>
          <AmountDisplay cents={-total} tone="expense" size="title" />
        </div>
        {transactions.length === 0 ? (
          <p className="text-[15px] text-ink-600">No transactions here.</p>
        ) : (
          <ul className="divide-y divide-ink-300/40">
            {transactions.map((txn) => (
              <li key={txn.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-ink-900">{txn.merchant ?? title}</p>
                  <p className="mt-0.5 text-[12.5px] text-ink-600">{toNairobiDateString(new Date(txn.occurred_at))}</p>
                </div>
                <AmountDisplay cents={-txn.amount_cents} tone="expense" size="body" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Sheet>
  )
}
