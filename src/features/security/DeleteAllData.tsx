import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Sheet } from '../../components/ui/Sheet'
import { useToast } from '../../components/ui/Toast'
import { useDeleteAllData } from './deleteData'

/**
 * The "Delete all data" danger action (PRD F11). Guarded by a type-to-confirm
 * sheet that spells out exactly what's removed and what's kept, so an
 * irreversible wipe never hides behind a single tap (CLAUDE.md: confirm hard-to-
 * reverse actions). The user performs it themselves; on success the app resets
 * to onboarding.
 */
const CONFIRM_WORD = 'DELETE'

export function DeleteAllData() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Card className="space-y-3">
        <div>
          <p className="text-[15px] font-semibold text-ink-900">Delete all data</p>
          <p className="mt-0.5 text-[12.5px] text-ink-600">
            Remove every transaction, goal, bill, and streak. Your accounts and categories stay so you can start over.
          </p>
        </div>
        <Button variant="ghost" className="text-coral-600" onClick={() => setOpen(true)}>
          Delete all data
        </Button>
      </Card>

      <Sheet open={open} onClose={() => setOpen(false)} title="Delete all data">
        {open && <ConfirmBody onClose={() => setOpen(false)} />}
      </Sheet>
    </>
  )
}

function ConfirmBody({ onClose }: { onClose: () => void }) {
  const { showToast } = useToast()
  const navigate = useNavigate()
  const deleteAll = useDeleteAllData()
  const [confirm, setConfirm] = useState('')

  const canDelete = confirm.trim().toUpperCase() === CONFIRM_WORD && !deleteAll.isPending

  const handleDelete = () => {
    if (!canDelete) return
    deleteAll.mutate(undefined, {
      onSuccess: () => {
        showToast({ title: 'Your data was deleted', variant: 'success' })
        onClose()
        navigate('/')
      },
      onError: () => showToast({ title: "Couldn't delete everything. Try again", variant: 'warn' }),
    })
  }

  return (
    <div className="space-y-5 py-2">
      <p className="text-[14px] leading-snug text-ink-900">
        This permanently removes every transaction, goal, contribution, bill, and your streak. It can’t be undone. Your
        accounts and categories stay so you can start fresh.
      </p>

      <label className="block space-y-2">
        <span className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-600">
          Type {CONFIRM_WORD} to confirm
        </span>
        <input
          type="text"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          aria-label={`Type ${CONFIRM_WORD} to confirm`}
          className="h-12 w-full rounded-card bg-paper-0 px-4 text-[15px] text-ink-900 placeholder:text-ink-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600"
        />
      </label>

      <div className="flex gap-2">
        <Button variant="secondary" fullWidth onClick={onClose} disabled={deleteAll.isPending}>
          Keep my data
        </Button>
        <Button
          fullWidth
          className="bg-coral-600"
          onClick={handleDelete}
          disabled={!canDelete}
          loading={deleteAll.isPending}
        >
          Delete everything
        </Button>
      </div>
    </div>
  )
}
