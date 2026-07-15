import { TZDate } from '@date-fns/tz'
import { format } from 'date-fns'
import { AmountDisplay } from '../../components/ui/AmountDisplay'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ProgressRing } from '../../components/ui/ProgressRing'
import { PencilIcon, TrashIcon } from '../../components/ui/icons'
import { NAIROBI_TZ } from '../../lib/safeToSpend'
import { formatKES } from '../../lib/money'
import type { Goal } from './types'
import { goalProgressFraction, isGoalReached, type GoalProjection } from './goalMath'

/**
 * One savings goal (PRD F7 / §4.4): a progress ring, the saved-of-target
 * figures, a projected finish line (from the trailing-30-day rate), and a
 * first-class Contribute action. Tone stays encouraging, never nagging — a
 * goal with no recent contributions invites, it doesn't scold (CLAUDE.md).
 */

export interface GoalCardProps {
  goal: Goal
  savedCents: number
  projection: GoalProjection
  onContribute: () => void
  onEdit: () => void
  onDelete: () => void
}

function projectionLine(goal: Goal, projection: GoalProjection): string {
  if (projection.status === 'reached') return 'Reached. Nicely done'
  if (projection.status === 'no-rate') {
    return goal.target_date ? `Target ${formatDate(goal.target_date)}` : 'Add a little to see your finish date'
  }
  if (projection.date) return `On track for ${format(new TZDate(projection.date, NAIROBI_TZ), 'd MMM yyyy')}`
  return ''
}

function formatDate(dateString: string): string {
  // A plain yyyy-MM-dd (no time) — render as a Nairobi calendar date.
  return format(new TZDate(`${dateString}T12:00:00`, NAIROBI_TZ), 'd MMM yyyy')
}

export function GoalCard({ goal, savedCents, projection, onContribute, onEdit, onDelete }: GoalCardProps) {
  const progress = goalProgressFraction(savedCents, goal.target_cents)
  const reached = isGoalReached(savedCents, goal.target_cents)
  const pct = Math.round(progress * 100)

  return (
    <Card>
      <div className="flex items-center gap-4">
        <ProgressRing
          progress={progress}
          size={92}
          strokeWidth={9}
          fillColor={reached ? 'var(--leaf-600)' : 'var(--coral-600)'}
          label={`${goal.name}: ${pct}% saved`}
        >
          <span className="text-[22px]" aria-hidden="true">
            {goal.emoji ?? '🎯'}
          </span>
        </ProgressRing>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 truncate text-[17px] font-semibold text-ink-900">{goal.name}</p>
            <div className="flex flex-shrink-0">
              <IconButton label={`Edit ${goal.name}`} onClick={onEdit}>
                <PencilIcon className="h-5 w-5" />
              </IconButton>
              <IconButton label={`Delete ${goal.name}`} onClick={onDelete}>
                <TrashIcon className="h-5 w-5" />
              </IconButton>
            </div>
          </div>
          <p className="mt-0.5 flex items-baseline gap-1.5">
            <AmountDisplay cents={savedCents} tone={reached ? 'income' : 'default'} size="body" />
            <span className="text-[12.5px] text-ink-600">of {formatKES(goal.target_cents)}</span>
          </p>
          <p className="mt-1 text-[12.5px] text-ink-600">{projectionLine(goal, projection)}</p>
        </div>
      </div>

      <Button variant={reached ? 'secondary' : 'primary'} fullWidth className="mt-4" onClick={onContribute}>
        {reached ? 'Add more' : 'Contribute'}
      </Button>
    </Card>
  )
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-full text-ink-600 hover:bg-paper-50 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600"
    >
      {children}
    </button>
  )
}
