import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Keypad } from '../../components/ui/Keypad'
import { Sheet } from '../../components/ui/Sheet'
import { useToast } from '../../components/ui/Toast'
import { WEEKS_PER_MONTH } from '../insights/insightsMath'
import { formatKES } from '../../lib/money'
import { categoryIcon } from '../transactions/iconMaps'
import type { Category } from '../transactions/types'
import { useClearBudget, useSetBudget } from './mutations'

/**
 * Set or clear a category's MONTHLY budget cap. Uses the same keypad as the add
 * flow so entry feels familiar. Buttons + handlers only — no `<form>` in a sheet
 * (CLAUDE.md). The sheet body only mounts while open (fresh keypad seed per open).
 */
export function BudgetEditorSheet({
  open,
  onClose,
  category,
  currentCapCents,
}: {
  open: boolean
  onClose: () => void
  category: Category | null
  currentCapCents: number | null
}) {
  return (
    <Sheet open={open} onClose={onClose} title={category ? `Budget · ${category.name}` : 'Budget'}>
      {open && category && (
        <BudgetEditorBody category={category} currentCapCents={currentCapCents} onClose={onClose} />
      )}
    </Sheet>
  )
}

function BudgetEditorBody({
  category,
  currentCapCents,
  onClose,
}: {
  category: Category
  currentCapCents: number | null
  onClose: () => void
}) {
  const { showToast } = useToast()
  const setBudget = useSetBudget()
  const clearBudget = useClearBudget()
  const [amountCents, setAmountCents] = useState(currentCapCents ?? 0)

  const weeklyCents = amountCents > 0 ? Math.round(amountCents / WEEKS_PER_MONTH) : 0

  const handleSave = () => {
    if (amountCents <= 0) return
    setBudget.mutate(
      { categoryId: category.id, amountCents },
      {
        onSuccess: () => {
          showToast({ title: 'Budget set', description: `${category.name} · ${formatKES(amountCents)}/mo`, variant: 'success' })
          onClose()
        },
        onError: () => showToast({ title: "Couldn't save that budget", variant: 'warn' }),
      },
    )
  }

  const handleClear = () => {
    clearBudget.mutate(category.id, {
      onSuccess: () => {
        showToast({ title: 'Budget removed', description: category.name, variant: 'info' })
        onClose()
      },
      onError: () => showToast({ title: "Couldn't remove that budget", variant: 'warn' }),
    })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-[15px] text-ink-600">
        <span className="text-[18px]" aria-hidden="true">
          {categoryIcon(category)}
        </span>
        <span>Monthly cap for {category.name}</span>
      </div>

      <Keypad valueCents={amountCents} onChange={setAmountCents} />

      <p className="text-center text-[13px] text-ink-600">
        {weeklyCents > 0 ? `≈ ${formatKES(weeklyCents)} a week` : 'Enter a monthly amount'}
      </p>

      <div className="space-y-2">
        <Button fullWidth size="lg" disabled={amountCents <= 0 || setBudget.isPending} loading={setBudget.isPending} onClick={handleSave}>
          Save budget
        </Button>
        {currentCapCents !== null && (
          <Button variant="secondary" fullWidth loading={clearBudget.isPending} onClick={handleClear}>
            Remove budget
          </Button>
        )}
      </div>
    </div>
  )
}
