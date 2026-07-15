import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Keypad } from '../../components/ui/Keypad'
import { Sheet } from '../../components/ui/Sheet'
import { useToast } from '../../components/ui/Toast'
import { formatKES } from '../../lib/money'
import { useContributeToGoal } from './mutations'
import type { Goal } from './types'

/**
 * Contribute to a goal (PRD F7: contributing is a first-class quick action).
 * A keypad amount, one tap to add. When this contribution reaches the target,
 * `onReached` fires so the parent can celebrate once.
 */
export interface ContributeSheetProps {
  open: boolean
  onClose: () => void
  goal: Goal | null
  /** Fired once when a contribution first reaches the target. */
  onReached: () => void
}

export function ContributeSheet({ open, onClose, goal, onReached }: ContributeSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title={goal ? `Add to ${goal.name}` : 'Contribute'}>
      {open && goal && <ContributeBody goal={goal} onClose={onClose} onReached={onReached} />}
    </Sheet>
  )
}

function ContributeBody({ goal, onClose, onReached }: { goal: Goal; onClose: () => void; onReached: () => void }) {
  const { showToast } = useToast()
  const contribute = useContributeToGoal()
  const [amountCents, setAmountCents] = useState(0)

  const canAdd = amountCents > 0 && !contribute.isPending

  const handleAdd = () => {
    if (!canAdd) return
    contribute.mutate(
      {
        goalId: goal.id,
        amountCents,
        targetCents: goal.target_cents,
        alreadyAchieved: goal.achieved_at !== null,
      },
      {
        onSuccess: ({ justReached }) => {
          if (justReached) onReached()
          else showToast({ title: 'Added', description: `${formatKES(amountCents)} to ${goal.name}`, variant: 'success' })
          onClose()
        },
        onError: () => showToast({ title: "Couldn't add that", description: 'Try again.', variant: 'warn' }),
      },
    )
  }

  return (
    <div className="space-y-5">
      {/* The Keypad renders its own amount display. */}
      <Keypad valueCents={amountCents} onChange={setAmountCents} />
      <Button fullWidth size="lg" onClick={handleAdd} loading={contribute.isPending} disabled={!canAdd}>
        {amountCents > 0 ? `Add ${formatKES(amountCents)}` : 'Add'}
      </Button>
    </div>
  )
}
