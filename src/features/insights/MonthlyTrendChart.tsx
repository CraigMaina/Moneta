import { cn } from '../../lib/cn'
import { formatKES } from '../../lib/money'
import type { MonthTotals } from './insightsMath'
import { monthKeyShortLabel } from './insightsMath'

/**
 * A small grouped-bar trend (PRD F10: "spending trend over 3 months"), shown
 * over the last N months with income (leaf) and expense (coral) side by side.
 * CSS-height bars, not SVG — responsive and crisp with no chart dependency.
 * Tapping a month selects it (drives the rest of the screen), so the chart is
 * also the month navigator. Bars are scaled to the largest value on show, so
 * relative months read at a glance.
 */

export interface MonthlyTrendChartProps {
  data: MonthTotals[]
  selectedMonthKey: string
  onSelectMonth: (monthKey: string) => void
}

const CHART_HEIGHT_PX = 120

export function MonthlyTrendChart({ data, selectedMonthKey, onSelectMonth }: MonthlyTrendChartProps) {
  const maxCents = Math.max(1, ...data.flatMap((d) => [d.incomeCents, d.expenseCents]))

  const barHeight = (cents: number) => `${(cents / maxCents) * CHART_HEIGHT_PX}px`

  return (
    <div>
      <div className="flex items-end justify-between gap-2" style={{ height: CHART_HEIGHT_PX }}>
        {data.map((month) => {
          const selected = month.monthKey === selectedMonthKey
          return (
            <button
              key={month.monthKey}
              type="button"
              onClick={() => onSelectMonth(month.monthKey)}
              aria-pressed={selected}
              aria-label={`${monthKeyShortLabel(month.monthKey)}: in ${formatKES(month.incomeCents)}, out ${formatKES(month.expenseCents)}`}
              className="group flex h-full flex-1 items-end justify-center gap-1 rounded-t-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600"
            >
              <span
                className={cn('w-1/2 max-w-3 rounded-t-full bg-leaf-600 transition-opacity', !selected && 'opacity-45 group-hover:opacity-70')}
                style={{ height: barHeight(month.incomeCents) }}
              />
              <span
                className={cn('w-1/2 max-w-3 rounded-t-full bg-coral-600 transition-opacity', !selected && 'opacity-45 group-hover:opacity-70')}
                style={{ height: barHeight(month.expenseCents) }}
              />
            </button>
          )
        })}
      </div>
      <div className="mt-2 flex justify-between gap-2">
        {data.map((month) => (
          <span
            key={month.monthKey}
            className={cn(
              'flex-1 text-center text-[12.5px]',
              month.monthKey === selectedMonthKey ? 'font-semibold text-ink-900' : 'text-ink-600',
            )}
          >
            {monthKeyShortLabel(month.monthKey)}
          </span>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-center gap-4 text-[12.5px] text-ink-600">
        <LegendDot className="bg-leaf-600" label="In" />
        <LegendDot className="bg-coral-600" label="Out" />
      </div>
    </div>
  )
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn('h-2.5 w-2.5 rounded-full', className)} aria-hidden="true" />
      {label}
    </span>
  )
}
