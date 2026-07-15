import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Keypad } from '../../components/ui/Keypad'
import { Sheet } from '../../components/ui/Sheet'
import { useToast } from '../../components/ui/Toast'
import { EmojiPicker } from '../settings/EmojiPicker'
import { useCreateGoal, useUpdateGoal } from './mutations'
import type { Goal } from './types'

/**
 * Add or edit a savings goal (PRD F7). Fresh mount per open seeds the fields
 * from `goal` without a setState-in-effect (the app's sheet pattern). No
 * `<form>` in the sheet (CLAUDE.md). Target amount uses the same keypad as
 * manual entry so money stays integer cents end to end.
 */
export interface GoalEditorSheetProps {
  open: boolean
  onClose: () => void
  goal?: Goal | null
}

export function GoalEditorSheet({ open, onClose, goal }: GoalEditorSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title={goal ? 'Edit goal' : 'New goal'}>
      {open && <GoalEditorBody goal={goal} onClose={onClose} />}
    </Sheet>
  )
}

function GoalEditorBody({ goal, onClose }: { goal?: Goal | null; onClose: () => void }) {
  const { showToast } = useToast()
  const createGoal = useCreateGoal()
  const updateGoal = useUpdateGoal()
  const isEdit = Boolean(goal)

  const [name, setName] = useState(goal?.name ?? '')
  const [targetCents, setTargetCents] = useState(goal?.target_cents ?? 0)
  const [targetDate, setTargetDate] = useState(goal?.target_date ?? '')
  const [emoji, setEmoji] = useState<string | null>(goal?.emoji ?? '🎯')

  const saving = createGoal.isPending || updateGoal.isPending
  const canSave = name.trim().length > 0 && targetCents > 0 && !saving

  const handleSave = () => {
    if (!canSave) return
    const payload = {
      name: name.trim(),
      target_cents: targetCents,
      target_date: targetDate ? targetDate : null,
      emoji,
    }
    const onError = () => showToast({ title: "Couldn't save that", variant: 'warn' })

    if (goal) {
      updateGoal.mutate(
        { id: goal.id, patch: payload },
        {
          onSuccess: () => {
            showToast({ title: 'Saved', variant: 'success' })
            onClose()
          },
          onError,
        },
      )
    } else {
      createGoal.mutate(payload, {
        onSuccess: () => {
          showToast({ title: 'Goal created', variant: 'success' })
          onClose()
        },
        onError,
      })
    }
  }

  return (
    <div className="space-y-5">
      <label className="block space-y-2">
        <span className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-600">What are you saving for?</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Emergency fund, Deposit, Trip"
          aria-label="Goal name"
          className="h-12 w-full rounded-card bg-paper-0 px-4 text-[15px] text-ink-900 placeholder:text-ink-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600"
        />
      </label>

      {/* The Keypad renders its own "Amount" display, so no separate hero here. */}
      <Keypad valueCents={targetCents} onChange={setTargetCents} />

      <label className="block space-y-2">
        <span className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-600">Target date (optional)</span>
        <input
          type="date"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
          aria-label="Target date"
          className="h-12 w-full rounded-card bg-paper-0 px-4 text-[15px] text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600"
        />
      </label>

      <div className="space-y-2">
        <span className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-600">Icon</span>
        <EmojiPicker value={emoji} onChange={setEmoji} />
      </div>

      <Button fullWidth size="lg" onClick={handleSave} loading={saving} disabled={!canSave}>
        {isEdit ? 'Save changes' : 'Create goal'}
      </Button>
    </div>
  )
}
