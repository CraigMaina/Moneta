import { Button } from '../../components/ui/Button'
import { CategoryChip } from '../../components/ui/CategoryChip'
import { Sheet } from '../../components/ui/Sheet'
import { useToast } from '../../components/ui/Toast'
import { categoryIcon } from './iconMaps'
import { useUpdateTransaction } from './mutations'
import { useCategories } from './queries'
import type { Transaction } from './types'

export interface RecategorizeSheetProps {
  /** The transaction being recategorized, or `null` when the sheet is closed. */
  transaction: Transaction | null
  onClose: () => void
}

/**
 * The "quick category picker" sheet for re-categorizing a transaction from
 * the Transactions list (swipe-right, or the row's "···" actions menu).
 * Reuses the existing `CategoryChip`/`Sheet` primitives directly — no new
 * picker UI needed.
 */
export function RecategorizeSheet({ transaction, onClose }: RecategorizeSheetProps) {
  const categoriesQuery = useCategories()
  const updateTransaction = useUpdateTransaction()
  const { showToast } = useToast()

  const relevantCategories = (categoriesQuery.data ?? []).filter(
    (c) => c.kind === (transaction?.kind === 'income' ? 'income' : 'expense'),
  )

  const handleSelect = (categoryId: string) => {
    if (!transaction) return
    updateTransaction.mutate(
      { id: transaction.id, patch: { category_id: categoryId } },
      {
        onSuccess: () => {
          showToast({ title: 'Recategorized', variant: 'success' })
          onClose()
        },
        onError: () => {
          showToast({
            title: "Couldn't recategorize that",
            description: 'Check your connection and try again.',
            variant: 'warn',
          })
        },
      },
    )
  }

  return (
    <Sheet open={transaction !== null} onClose={onClose} title="Recategorize">
      {transaction && (
        <div className="space-y-4">
          {categoriesQuery.isLoading ? (
            <div className="flex gap-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-11 w-24 flex-shrink-0 animate-pulse rounded-full bg-paper-0 motion-reduce:animate-none"
                  aria-hidden="true"
                />
              ))}
            </div>
          ) : categoriesQuery.isError ? (
            <div className="flex items-center justify-between gap-3 rounded-card bg-paper-0 px-4 py-3">
              <p className="text-[15px] text-ink-600">Couldn&apos;t load categories.</p>
              <Button variant="secondary" onClick={() => categoriesQuery.refetch()}>
                Retry
              </Button>
            </div>
          ) : relevantCategories.length === 0 ? (
            <p className="text-[15px] text-ink-600">No categories yet — nothing to recategorize into.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {relevantCategories.map((category) => (
                <CategoryChip
                  key={category.id}
                  icon={categoryIcon(category)}
                  label={category.name}
                  selected={category.id === transaction.category_id}
                  onSelect={() => handleSelect(category.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </Sheet>
  )
}
