import type { ReactNode } from 'react'
import { AmountDisplay } from '../../components/ui/AmountDisplay'
import { cn } from '../../lib/cn'
import { chartColor } from './chartPalette'

/**
 * A category-spend donut with a tappable legend (PRD F10: "category donut with
 * drill-down"). Pure SVG — no chart dependency (CLAUDE.md prefers inline SVG).
 * Slices are drawn as dashed circle arcs (crisp at any size), largest first,
 * starting at 12 o'clock. Each legend row is a button so the parent can drill
 * into that category's transactions.
 */

export interface DonutSlice {
  id: string
  label: string
  amountCents: number
  icon?: ReactNode
}

export interface CategoryDonutProps {
  slices: DonutSlice[]
  /** Drill-down: the tapped slice's id (never called for the synthetic Other bucket). */
  onSelect?: (id: string) => void
  /** Ids that shouldn't be tappable (e.g. the folded "Other" bucket). */
  nonInteractiveIds?: ReadonlySet<string>
}

const SIZE = 176
const STROKE = 26
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function CategoryDonut({ slices, onSelect, nonInteractiveIds }: CategoryDonutProps) {
  const total = slices.reduce((sum, s) => sum + s.amountCents, 0)
  if (total <= 0) return null

  const fractions = slices.map((s) => s.amountCents / total)
  const arcs = slices.map((slice, index) => {
    const dash = (fractions[index] ?? 0) * CIRCUMFERENCE
    // A hairline gap between slices reads cleaner; clamp so tiny slices still show.
    const gap = Math.min(2, dash)
    // Cumulative fraction of the slices before this one (n is ≤ 6, so O(n²) is fine).
    const offsetFraction = fractions.slice(0, index).reduce((a, b) => a + b, 0)
    return {
      id: slice.id,
      color: chartColor(index),
      dashArray: `${Math.max(dash - gap, 0.001)} ${CIRCUMFERENCE}`,
      dashOffset: -offsetFraction * CIRCUMFERENCE,
    }
  })

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="Spending by category">
          <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
            {arcs.map((arc) => (
              <circle
                key={arc.id}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke={arc.color}
                strokeWidth={STROKE}
                strokeDasharray={arc.dashArray}
                strokeDashoffset={arc.dashOffset}
                strokeLinecap="butt"
              />
            ))}
          </g>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-600">Spent</span>
          <AmountDisplay cents={-total} tone="expense" size="title" />
        </div>
      </div>

      <ul className="w-full space-y-1">
        {slices.map((slice, index) => {
          const interactive = onSelect && !nonInteractiveIds?.has(slice.id)
          const pct = Math.round((slice.amountCents / total) * 100)
          const row = (
            <div className="flex items-center gap-3 px-2 py-2">
              <span
                className="h-3 w-3 flex-shrink-0 rounded-full"
                style={{ backgroundColor: chartColor(index) }}
                aria-hidden="true"
              />
              {slice.icon && (
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center text-ink-900" aria-hidden="true">
                  {slice.icon}
                </span>
              )}
              <span className="min-w-0 flex-1 truncate text-[15px] text-ink-900">{slice.label}</span>
              <span className="text-[12.5px] tabular-nums text-ink-600">{pct}%</span>
              <span className="w-20 text-right">
                <AmountDisplay cents={-slice.amountCents} tone="expense" size="body" />
              </span>
            </div>
          )
          return (
            <li key={slice.id}>
              {interactive ? (
                <button
                  type="button"
                  onClick={() => onSelect?.(slice.id)}
                  className={cn(
                    'w-full rounded-card text-left transition-colors hover:bg-paper-50',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600',
                  )}
                >
                  {row}
                </button>
              ) : (
                row
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
