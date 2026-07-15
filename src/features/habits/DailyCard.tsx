import { useEffect, useMemo, useRef } from 'react'
import { TZDate } from '@date-fns/tz'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { formatKES } from '../../lib/money'
import { NAIROBI_TZ } from '../../lib/safeToSpend'
import { streakView } from '../../lib/streaks'
import { toNairobiDateString } from '../transactions/nairobiDate'
import { useTransactions } from '../transactions/queries'
import { useCountStreakDay, useStreak } from './streakData'

/**
 * The Home "morning money minute" + logging-streak surface (PRD F8). A day
 * counts when the user logs a transaction (auto-detected here) OR confirms "no
 * spend today". Tone is warm and never nagging — an unbroken streak is
 * celebrated, a fresh start is invited, nothing is shamed (CLAUDE.md).
 */

function dayStart(dateString: string): Date {
  const [y, m, d] = dateString.split('-').map(Number)
  return new TZDate(Number(y), Number(m) - 1, Number(d), 0, 0, 0, 0, NAIROBI_TZ)
}

export function DailyCard() {
  const now = useMemo(() => new Date(), [])
  const today = toNairobiDateString(now)
  const yesterday = toNairobiDateString(new Date(now.getTime() - 24 * 60 * 60 * 1000))

  const streakQuery = useStreak()
  const countStreak = useCountStreakDay()
  const from = useMemo(() => dayStart(yesterday), [yesterday])
  const txnsQuery = useTransactions({ from })

  const txns = txnsQuery.data ?? []
  const hasActivityToday = txns.some((t) => toNairobiDateString(new Date(t.occurred_at)) === today)
  const yesterdaySpentCents = txns
    .filter((t) => t.kind === 'expense' && toNairobiDateString(new Date(t.occurred_at)) === yesterday)
    .reduce((sum, t) => sum + t.amount_cents, 0)

  const state = streakQuery.data
  const view = state ? streakView(state, today) : null

  // Auto-count today the moment we know there's a logged transaction and today
  // hasn't counted yet — logging IS keeping the streak (PRD F8). Guarded so it
  // fires once; the mutation flips `countedToday`, closing the condition.
  const autoCounted = useRef(false)
  const mutate = countStreak.mutate
  useEffect(() => {
    if (!streakQuery.isSuccess || !view) return
    if (view.countedToday || !hasActivityToday || autoCounted.current || countStreak.isPending) return
    autoCounted.current = true
    mutate(today)
  }, [streakQuery.isSuccess, view, hasActivityToday, countStreak.isPending, mutate, today])

  if (streakQuery.isPending) {
    return <div className="h-20 animate-pulse rounded-card bg-paper-50 motion-reduce:animate-none" aria-hidden="true" />
  }
  if (streakQuery.isError || !view) return null

  const streakLabel =
    view.currentCount === 0
      ? 'Start a streak today'
      : `${view.currentCount}-day streak${view.countedToday ? '' : ' — keep it going'}`

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-[26px]" aria-hidden="true">
            {view.currentCount > 0 && view.countedToday ? '🔥' : '✨'}
          </span>
          <div>
            <p className="text-[15px] font-semibold text-ink-900">{streakLabel}</p>
            <p className="mt-0.5 text-[12.5px] text-ink-600">
              {yesterdaySpentCents > 0
                ? `Yesterday you spent ${formatKES(yesterdaySpentCents)}.`
                : 'No spend logged yesterday.'}
            </p>
          </div>
        </div>

        {!view.countedToday && !hasActivityToday && (
          <Button variant="secondary" size="md" onClick={() => mutate(today)} loading={countStreak.isPending}>
            No spend today
          </Button>
        )}
        {view.countedToday && (
          <span className="text-[13px] font-semibold text-leaf-600" aria-label="Streak kept today">
            Kept ✓
          </span>
        )}
      </div>
    </Card>
  )
}
