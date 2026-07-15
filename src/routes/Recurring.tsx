import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AmountDisplay } from '../components/ui/AmountDisplay'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { ArrowRightIcon, PencilIcon, PlusIcon, ReceiptIcon, TrashIcon } from '../components/ui/icons'
import { useToast } from '../components/ui/Toast'
import { cadenceLabel, dueLabel, dueStatus } from '../features/recurring/cadence'
import { RecurringEditorSheet } from '../features/recurring/RecurringEditorSheet'
import { useDeleteRecurringItem, useMarkRecurringPaid } from '../features/recurring/mutations'
import { useRecurringItems } from '../features/recurring/queries'
import type { RecurringItem } from '../features/transactions/types'
import { cn } from '../lib/cn'

/**
 * Recurring & bills (PRD F6). Manage repeating transactions that feed the
 * fixed-bills term of safe-to-spend; "Mark paid" books the transaction and
 * rolls the due date forward. Reached from Settings (not a bottom tab).
 */
export function Recurring() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const itemsQuery = useRecurringItems()
  const deleteItem = useDeleteRecurringItem()
  const markPaid = useMarkRecurringPaid()

  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<RecurringItem | null>(null)

  const items = itemsQuery.data ?? []

  const openCreate = () => {
    setEditing(null)
    setEditorOpen(true)
  }
  const openEdit = (item: RecurringItem) => {
    setEditing(item)
    setEditorOpen(true)
  }

  const handleMarkPaid = (item: RecurringItem) => {
    markPaid.mutate(item, {
      onSuccess: () => showToast({ title: 'Marked paid', description: item.merchant ?? 'Recurring', variant: 'success' }),
      onError: () => showToast({ title: "Couldn't mark paid", variant: 'warn' }),
    })
  }

  const handleDelete = (item: RecurringItem) => {
    deleteItem.mutate(item.id, {
      onError: () => showToast({ title: "Couldn't remove that", variant: 'warn' }),
    })
    showToast({ title: 'Removed', description: item.merchant ?? 'Recurring', variant: 'info' })
  }

  return (
    <main className="min-h-dvh bg-paper-0 pb-16">
      <div className="mx-auto max-w-md px-4 pt-[calc(env(safe-area-inset-top)+16px)]">
        <header className="flex items-center justify-between py-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/settings')}
              aria-label="Back to settings"
              className="flex h-11 w-11 items-center justify-center rounded-full text-ink-600 hover:bg-paper-50 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600"
            >
              <ArrowRightIcon className="h-5 w-5 rotate-180" />
            </button>
            <h1 className="font-display text-[22px] font-semibold text-ink-900">Recurring</h1>
          </div>
          {items.length > 0 && (
            <Button variant="ghost" size="md" onClick={openCreate}>
              <PlusIcon className="h-5 w-5" />
              New
            </Button>
          )}
        </header>

        <div className="mt-4">
          {itemsQuery.isPending ? (
            <div className="space-y-3">
              {[0, 1].map((i) => (
                <div key={i} className="h-20 animate-pulse rounded-card bg-paper-50 motion-reduce:animate-none" aria-hidden="true" />
              ))}
            </div>
          ) : itemsQuery.isError ? (
            <Card className="flex items-center justify-between gap-3">
              <p className="text-[15px] text-ink-600">Couldn&apos;t load your recurring items.</p>
              <Button variant="secondary" onClick={() => void itemsQuery.refetch()}>
                Retry
              </Button>
            </Card>
          ) : items.length === 0 ? (
            <Card className="p-0">
              <EmptyState
                icon={<ReceiptIcon />}
                title="No recurring items yet"
                description="Add your rent, subscriptions, or a regular income so your safe-to-spend accounts for them."
                actionLabel="Add recurring"
                onAction={openCreate}
              />
            </Card>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <RecurringRow
                  key={item.id}
                  item={item}
                  onMarkPaid={() => handleMarkPaid(item)}
                  onEdit={() => openEdit(item)}
                  onDelete={() => handleDelete(item)}
                  marking={markPaid.isPending}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <RecurringEditorSheet open={editorOpen} onClose={() => setEditorOpen(false)} item={editing} />
    </main>
  )
}

function RecurringRow({
  item,
  onMarkPaid,
  onEdit,
  onDelete,
  marking,
}: {
  item: RecurringItem
  onMarkPaid: () => void
  onEdit: () => void
  onDelete: () => void
  marking: boolean
}) {
  const status = dueStatus(item.next_due_date)
  const isIncome = item.kind === 'income'

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-ink-900">{item.merchant ?? 'Recurring'}</p>
          <p className="mt-0.5 text-[12.5px] text-ink-600">
            {cadenceLabel(item.cadence)} ·{' '}
            <span
              className={cn(
                status === 'overdue' ? 'font-semibold text-coral-600' : status === 'due-soon' ? 'font-semibold text-amber-600' : '',
              )}
            >
              {dueLabel(item.next_due_date)}
            </span>
          </p>
        </div>
        <AmountDisplay
          cents={isIncome ? item.amount_cents : -item.amount_cents}
          tone={isIncome ? 'income' : 'expense'}
          signed={isIncome}
          size="body"
        />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Button variant="secondary" size="md" className="flex-1" onClick={onMarkPaid} loading={marking}>
          {isIncome ? 'Mark received' : 'Mark paid'}
        </Button>
        <button
          type="button"
          aria-label={`Edit ${item.merchant ?? 'recurring'}`}
          onClick={onEdit}
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-ink-600 hover:bg-paper-50 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600"
        >
          <PencilIcon className="h-5 w-5" />
        </button>
        <button
          type="button"
          aria-label={`Remove ${item.merchant ?? 'recurring'}`}
          onClick={onDelete}
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-ink-600 hover:bg-paper-50 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600"
        >
          <TrashIcon className="h-5 w-5" />
        </button>
      </div>
    </Card>
  )
}
