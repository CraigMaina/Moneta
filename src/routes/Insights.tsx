import { useMemo, useState } from 'react'
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
import { BudgetsCard } from '../features/budgets/BudgetsCard'
import {
  OTHER_SLICE_ID,
  nairobiPeriodKey,
  periodInsights,
  periodKeyLabel,
  periodKeyShortLabel,
  periodSeriesFor,
  periodStartDate,
  recentPeriodKeys,
  withOtherBucket,
  type Granularity,
  type MonthInsights,
  type MonthTotals,
} from '../features/insights/insightsMath'
import { cn } from '../lib/cn'
import { useUiStore } from '../store/uiStore'

/**
 * Insights (PRD F10 / screen 6). All charts render from local data and work
 * offline. Transfers are excluded everywhere (that's `insightsMath`'s job).
 * The month shown is driven by the trend chart (tap a month) and the ‹ › nav.
 */

// How many periods the trend chart / navigator spans, per grain.
const PERIOD_WINDOW: Record<Granularity, number> = { month: 6, week: 8 }
// The category the parser books M-PESA/Fuliza fees to (see buildParsedRows).
const FEE_CATEGORY_NAME = 'Fees & Fuliza charges'
const UNCATEGORIZED_ID = '__uncategorized__'

export function Insights() {
  const activeSheet = useUiStore((s) => s.activeSheet)
  const openSheet = useUiStore((s) => s.openSheet)
  const closeSheet = useUiStore((s) => s.closeSheet)
  const openAddSheet = () => openSheet('add')

  const now = useMemo(() => new Date(), [])
  const [granularity, setGranularity] = useState<Granularity>('month')
  const periods = useMemo(() => recentPeriodKeys(now, PERIOD_WINDOW[granularity], granularity), [now, granularity])
  const currentPeriod = nairobiPeriodKey(now.toISOString(), granularity)
  const [selectedPeriod, setSelectedPeriod] = useState(currentPeriod)
  // 'closed' = sheet shut; otherwise the drilled category id (or null = uncategorized).
  const [drillCategoryId, setDrillCategoryId] = useState<string | null | 'closed'>('closed')

  // Switching grain re-keys everything (yyyy-MM vs yyyy-MM-dd), so land on the
  // current period of the new grain instead of keeping a now-invalid key.
  const changeGranularity = (next: Granularity) => {
    setGranularity(next)
    setSelectedPeriod(nairobiPeriodKey(now.toISOString(), next))
    setDrillCategoryId('closed')
  }

  const from = useMemo(() => periodStartDate(periods[0] ?? currentPeriod, granularity), [periods, currentPeriod, granularity])
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

  const periodData = useMemo(
    () => periodInsights(txns, selectedPeriod, granularity, { feeCategoryId }),
    [txns, selectedPeriod, granularity, feeCategoryId],
  )
  const series = useMemo(() => periodSeriesFor(txns, periods, granularity), [txns, periods, granularity])
  const labelFor = useMemo(() => (key: string) => periodKeyShortLabel(key, granularity), [granularity])

  const donutSlices: DonutSlice[] = useMemo(
    () =>
      withOtherBucket(periodData.byCategory, 5).map((slice) => {
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
    [periodData.byCategory, categoryById],
  )

  const selectedIndex = periods.indexOf(selectedPeriod)
  const goPrev = () => {
    const prev = periods[selectedIndex - 1]
    if (prev) setSelectedPeriod(prev)
  }
  const goNext = () => {
    const next = periods[selectedIndex + 1]
    if (next) setSelectedPeriod(next)
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
        nairobiPeriodKey(t.occurred_at, granularity) === selectedPeriod &&
        (t.category_id ?? null) === drillCategoryId,
    )
  }, [txns, drillCategoryId, selectedPeriod, granularity])

  return (
    <main className="min-h-dvh bg-paper-0 pb-28">
      <div className="mx-auto max-w-md px-4 pt-[calc(env(safe-area-inset-top)+24px)]">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-[22px] font-semibold text-ink-900">Insights</h1>
          <GranularityToggle value={granularity} onChange={changeGranularity} />
        </div>

        <MonthNav
          label={periodKeyLabel(selectedPeriod, granularity)}
          onPrev={goPrev}
          onNext={goNext}
          canPrev={selectedIndex > 0}
          canNext={selectedIndex < periods.length - 1}
        />

        <InsightsBody
          query={transactionsQuery}
          hasAnyData={txns.length > 0}
          monthData={periodData}
          series={series}
          selectedMonth={selectedPeriod}
          onSelectMonth={setSelectedPeriod}
          labelFor={labelFor}
          granularity={granularity}
          categoryById={categoryById}
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
        monthLabel={periodKeyLabel(selectedPeriod, granularity)}
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
      aria-label={direction === 'prev' ? 'Previous period' : 'Next period'}
      className="flex h-10 w-10 items-center justify-center rounded-full text-ink-600 hover:bg-paper-50 hover:text-ink-900 disabled:opacity-30 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600"
    >
      <ChevronRightIcon className={cn('h-5 w-5', direction === 'prev' && 'rotate-180')} />
    </button>
  )
}

interface InsightsBodyProps {
  query: { isPending: boolean; isError: boolean; refetch: () => void }
  hasAnyData: boolean
  monthData: MonthInsights
  series: MonthTotals[]
  selectedMonth: string
  onSelectMonth: (monthKey: string) => void
  labelFor: (periodKey: string) => string
  granularity: Granularity
  categoryById: Map<string, Category>
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
  labelFor,
  granularity,
  categoryById,
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

  const periodEmpty = monthData.incomeCents === 0 && monthData.expenseCents === 0
  const periodNoun = granularity === 'week' ? 'week' : 'month'

  return (
    <div className="mt-5 space-y-4">
      <CashFlowCard monthData={monthData} />

      <Card>
        <h2 className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-600">Trend</h2>
        <div className="mt-4">
          <MonthlyTrendChart data={series} selectedMonthKey={selectedMonth} onSelectMonth={onSelectMonth} labelFor={labelFor} />
        </div>
      </Card>

      <BudgetsCard byCategory={monthData.byCategory} categoryById={categoryById} granularity={granularity} />

      <Card>
        <h2 className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-600">Where it went</h2>
        {periodEmpty || donutSlices.length === 0 ? (
          <p className="mt-3 text-[15px] text-ink-600">No spending this {periodNoun}.</p>
        ) : (
          <div className="mt-4">
            <CategoryDonut slices={donutSlices} onSelect={onDrill} nonInteractiveIds={new Set([OTHER_SLICE_ID])} />
          </div>
        )}
      </Card>

      <FeesSpotlight feesCents={monthData.feesCents} expenseCents={monthData.expenseCents} periodNoun={periodNoun} />
    </div>
  )
}

function CashFlowCard({ monthData }: { monthData: MonthInsights }) {
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

function FeesSpotlight({ feesCents, expenseCents, periodNoun }: { feesCents: number; expenseCents: number; periodNoun: string }) {
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
            Transaction and Fuliza charges this {periodNoun}{pct > 0 ? `, ${pct}% of your spending` : ''}.
          </p>
        </>
      ) : (
        <p className="mt-2 text-[15px] text-ink-600">No fees this {periodNoun}. Nice.</p>
      )}
    </Card>
  )
}

/** Month/Week grain switch for the whole Insights screen. */
function GranularityToggle({ value, onChange }: { value: Granularity; onChange: (g: Granularity) => void }) {
  const options: { id: Granularity; label: string }[] = [
    { id: 'month', label: 'Month' },
    { id: 'week', label: 'Week' },
  ]
  return (
    <div role="group" aria-label="Time range" className="flex gap-1 rounded-full bg-paper-50 p-1">
      {options.map((option) => {
        const selected = value === option.id
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.id)}
            className={cn(
              'h-9 rounded-full px-3.5 text-[13px] font-semibold transition-colors duration-150 ease-out',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600 focus-visible:ring-offset-2 focus-visible:ring-offset-paper-50',
              selected ? 'bg-paper-0 text-coral-600 shadow-card' : 'text-ink-600',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
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
