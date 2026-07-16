import { TZDate } from '@date-fns/tz'
import { format } from 'date-fns'
import { motion, useReducedMotion, type PanInfo } from 'framer-motion'
import { AmountDisplay, type AmountDisplayTone } from '../../components/ui/AmountDisplay'
import { TagIcon, TransactionsIcon, TrashIcon } from '../../components/ui/icons'
import { NAIROBI_TZ } from '../../lib/safeToSpend'
import { accountIcon, categoryIcon } from './iconMaps'
import { resolveRowSwipeAction } from './rowSwipe'
import type { Account, Category, Transaction } from './types'

export interface TransactionRowProps {
  txn: Transaction
  category?: Category
  account?: Account
  onDelete: (txn: Transaction) => void
  onRecategorize: (txn: Transaction) => void
  onOpenActions: (txn: Transaction) => void
}

/**
 * One transaction row. Transfers render neutrally (no +/- sign, no
 * income/expense tint — CLAUDE.md: transfers are never income or expense).
 *
 * Swipe left commits delete, swipe right commits recategorize (skipped for
 * transfers, which have no category) — a Framer Motion `drag="x"` gesture
 * mirroring `Sheet.tsx`'s own drag-to-dismiss pattern (pinned
 * `dragConstraints`, elastic resistance, a pure exported threshold decision
 * unit-tested on its own in `rowSwipe.ts`, not via a simulated gesture).
 *
 * The backdrop labels behind the row are DECORATIVE ONLY (`aria-hidden`, not
 * focusable/clickable) — the real, always-available, gesture-free entry
 * point is the "···" actions button every row renders regardless of
 * `prefers-reduced-motion`. That button is simultaneously this row's
 * a11y/keyboard/reduced-motion fallback and its visually-discoverable
 * affordance; swiping is a bonus shortcut layered on top, never the only way
 * in. When motion is reduced, `drag` is simply omitted — the row can't move,
 * and the "···" button remains the sole (fully sufficient) path.
 */
export function TransactionRow({ txn, category, account, onDelete, onRecategorize, onOpenActions }: TransactionRowProps) {
  const prefersReducedMotion = useReducedMotion()

  const isTransfer = txn.kind === 'transfer'
  const isIncome = txn.kind === 'income'
  const primaryLabel = txn.merchant ?? category?.name ?? (isTransfer ? 'Transfer' : isIncome ? 'Income' : 'Expense')
  const displayCents = isIncome || isTransfer ? txn.amount_cents : -txn.amount_cents
  const tone: AmountDisplayTone = isIncome ? 'income' : isTransfer ? 'default' : 'expense'
  const timeLabel = format(new TZDate(new Date(txn.occurred_at), NAIROBI_TZ), 'h:mm a')
  const metaLabel = account ? `${timeLabel} · ${account.name}` : timeLabel

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const action = resolveRowSwipeAction(info.offset.x, info.velocity.x)
    if (action === 'delete') onDelete(txn)
    if (action === 'recategorize' && !isTransfer) onRecategorize(txn)
  }

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 flex items-stretch justify-between" aria-hidden="true">
        <div className="flex items-center gap-2 bg-coral-100 px-4 text-[13px] font-semibold text-coral-600">
          <TagIcon className="h-4 w-4" />
          Recategorize
        </div>
        <div className="flex items-center gap-2 bg-ink-900 px-4 text-[13px] font-semibold text-white">
          Delete
          <TrashIcon className="h-4 w-4" />
        </div>
      </div>

      <motion.div
        data-testid={`transaction-row-${txn.id}`}
        drag={prefersReducedMotion ? false : 'x'}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.5}
        onDragEnd={handleDragEnd}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        className="relative flex items-center gap-3 bg-paper-0 px-4 py-3"
      >
        <span
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-paper-50 text-ink-600"
          aria-hidden="true"
        >
          {isTransfer
            ? account
              ? accountIcon(account)
              : <TransactionsIcon className="h-5 w-5" />
            : categoryIcon(category ?? { icon: null })}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-ink-900">{primaryLabel}</p>
          <p className="mt-0.5 truncate text-[12.5px] text-ink-600">{metaLabel}</p>
        </div>
        <AmountDisplay
          cents={displayCents}
          tone={tone}
          signed={isIncome}
          size="body"
          className="flex-shrink-0 whitespace-nowrap"
        />
        <button
          type="button"
          aria-label={`Actions for ${primaryLabel}`}
          onClick={() => onOpenActions(txn)}
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-ink-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600 focus-visible:ring-offset-2 focus-visible:ring-offset-paper-0"
        >
          <span aria-hidden="true" className="text-[20px] leading-none tracking-tighter">
            &bull;&bull;&bull;
          </span>
        </button>
      </motion.div>
    </div>
  )
}
