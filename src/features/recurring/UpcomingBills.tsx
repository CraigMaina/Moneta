import { useMemo } from 'react'
import { AmountDisplay } from '../../components/ui/AmountDisplay'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { useToast } from '../../components/ui/Toast'
import { cn } from '../../lib/cn'
import type { RecurringItem } from '../transactions/types'
import { dueLabel, dueStatus, isDueSoonOrOverdue } from './cadence'
import { useMarkRecurringPaid } from './mutations'
import { useRecurringItems } from './queries'

/**
 * Home reminder surface for bills due soon or overdue (PRD F6: remind ~2 days
 * before due, one-tap "mark paid"). Deliberately renders NOTHING when there's
 * nothing due, while loading, or on error — it's a supplementary nudge, not a
 * primary list, so it never adds noise or an error card to Home. In-app
 * reminders now; Web Push scheduling is F8.
 */
export function UpcomingBills() {
  const { showToast } = useToast()
  const itemsQuery = useRecurringItems()
  const markPaid = useMarkRecurringPaid()

  const due = useMemo(
    () => (itemsQuery.data ?? []).filter((item) => isDueSoonOrOverdue(item.next_due_date)),
    [itemsQuery.data],
  )

  if (due.length === 0) return null

  const handleMarkPaid = (item: RecurringItem) => {
    markPaid.mutate(item, {
      onSuccess: () => showToast({ title: 'Marked paid', description: item.merchant ?? 'Recurring', variant: 'success' }),
      onError: () => showToast({ title: "Couldn't mark paid", variant: 'warn' }),
    })
  }

  return (
    <Card className="p-0">
      <ul className="divide-y divide-ink-300/40">
        {due.map((item) => {
          const status = dueStatus(item.next_due_date)
          const isIncome = item.kind === 'income'
          return (
            <li key={item.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-ink-900">{item.merchant ?? 'Recurring'}</p>
                <p
                  className={cn(
                    'mt-0.5 text-[12.5px]',
                    status === 'overdue' ? 'font-semibold text-coral-600' : 'font-semibold text-amber-600',
                  )}
                >
                  {dueLabel(item.next_due_date)}
                </p>
              </div>
              <AmountDisplay
                cents={isIncome ? item.amount_cents : -item.amount_cents}
                tone={isIncome ? 'income' : 'expense'}
                signed={isIncome}
                size="body"
              />
              <Button variant="secondary" size="md" onClick={() => handleMarkPaid(item)} loading={markPaid.isPending}>
                {isIncome ? 'Received' : 'Pay'}
              </Button>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
