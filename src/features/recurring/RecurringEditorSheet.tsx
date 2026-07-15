import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { CategoryChip } from '../../components/ui/CategoryChip'
import { Keypad } from '../../components/ui/Keypad'
import { Sheet } from '../../components/ui/Sheet'
import { useToast } from '../../components/ui/Toast'
import { cn } from '../../lib/cn'
import { accountIcon } from '../transactions/iconMaps'
import { CategoryPicker } from '../transactions/CategoryPicker'
import { toNairobiDateString } from '../transactions/nairobiDate'
import { useAccounts, useCategories } from '../transactions/queries'
import type { RecurringItem } from '../transactions/types'
import { CADENCES, type Cadence } from './cadence'
import { useCreateRecurringItem, useUpdateRecurringItem } from './mutations'

/**
 * Add or edit a recurring item / bill (PRD F6). Fresh mount per open seeds the
 * fields (no setState-in-effect). No `<form>` in the sheet (CLAUDE.md). Kind is
 * expense or income only — a recurring transfer isn't a bill.
 */
export interface RecurringPrefill {
  merchant?: string
  amountCents?: number
  categoryId?: string | null
}

export interface RecurringEditorSheetProps {
  open: boolean
  onClose: () => void
  item?: RecurringItem | null
  /** Seed values for a *new* item (e.g. from a subscription nudge); ignored when `item` is set. */
  prefill?: RecurringPrefill
}

type RecurringKind = 'income' | 'expense'

export function RecurringEditorSheet({ open, onClose, item, prefill }: RecurringEditorSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title={item ? 'Edit recurring' : 'New recurring'}>
      {open && <RecurringEditorBody item={item} prefill={prefill} onClose={onClose} />}
    </Sheet>
  )
}

function RecurringEditorBody({
  item,
  prefill,
  onClose,
}: {
  item?: RecurringItem | null
  prefill?: RecurringPrefill
  onClose: () => void
}) {
  const { showToast } = useToast()
  const accountsQuery = useAccounts()
  const categoriesQuery = useCategories()
  const createItem = useCreateRecurringItem()
  const updateItem = useUpdateRecurringItem()
  const isEdit = Boolean(item)

  const accounts = accountsQuery.data ?? []
  const categories = categoriesQuery.data ?? []

  const [kind, setKind] = useState<RecurringKind>((item?.kind as RecurringKind | undefined) ?? 'expense')
  const [amountCents, setAmountCents] = useState(item?.amount_cents ?? prefill?.amountCents ?? 0)
  const [accountId, setAccountId] = useState<string | null>(item?.account_id ?? accounts[0]?.id ?? null)
  const [categoryId, setCategoryId] = useState<string | null>(item?.category_id ?? prefill?.categoryId ?? null)
  const [merchant, setMerchant] = useState(item?.merchant ?? prefill?.merchant ?? '')
  const [cadence, setCadence] = useState<Cadence>((item?.cadence as Cadence | undefined) ?? 'monthly')
  const [nextDueDate, setNextDueDate] = useState(item?.next_due_date ?? toNairobiDateString(new Date()))

  const relevantCategories = categories.filter((c) => c.kind === kind)
  const saving = createItem.isPending || updateItem.isPending
  const canSave = amountCents > 0 && Boolean(accountId) && merchant.trim().length > 0 && !saving

  const handleSave = () => {
    if (!canSave || !accountId) return
    const payload = {
      kind,
      amount_cents: amountCents,
      account_id: accountId,
      category_id: kind === 'expense' || kind === 'income' ? categoryId : null,
      merchant: merchant.trim(),
      cadence,
      next_due_date: nextDueDate,
    }
    const onError = () => showToast({ title: "Couldn't save that", variant: 'warn' })

    if (item) {
      updateItem.mutate(
        { id: item.id, patch: payload },
        {
          onSuccess: () => {
            showToast({ title: 'Saved', variant: 'success' })
            onClose()
          },
          onError,
        },
      )
    } else {
      createItem.mutate(payload, {
        onSuccess: () => {
          showToast({ title: 'Recurring added', variant: 'success' })
          onClose()
        },
        onError,
      })
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-1.5">
        {(['expense', 'income'] as RecurringKind[]).map((option) => (
          <SegButton
            key={option}
            active={kind === option}
            onClick={() => {
              setKind(option)
              setCategoryId(null)
            }}
          >
            {option === 'expense' ? 'Bill / spend' : 'Income'}
          </SegButton>
        ))}
      </div>

      <Keypad valueCents={amountCents} onChange={setAmountCents} />

      <label className="block space-y-2">
        <span className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-600">Name</span>
        <input
          type="text"
          value={merchant}
          onChange={(e) => setMerchant(e.target.value)}
          placeholder="e.g. Rent, Netflix, Sacco"
          aria-label="Recurring name"
          className="h-12 w-full rounded-card bg-paper-0 px-4 text-[15px] text-ink-900 placeholder:text-ink-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600"
        />
      </label>

      <div className="space-y-2">
        <span className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-600">Account</span>
        <div className="flex flex-wrap gap-2">
          {accounts.map((account) => (
            <CategoryChip
              key={account.id}
              icon={accountIcon(account)}
              label={account.name}
              selected={accountId === account.id}
              onSelect={() => setAccountId(account.id)}
            />
          ))}
        </div>
      </div>

      {relevantCategories.length > 0 && (
        <div className="space-y-2">
          <span className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-600">Category</span>
          <CategoryPicker categories={relevantCategories} selectedId={categoryId} onSelect={setCategoryId} />
        </div>
      )}

      <div className="space-y-2">
        <span className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-600">Repeats</span>
        <div className="grid grid-cols-2 gap-1.5">
          {CADENCES.map((option) => (
            <SegButton key={option.value} active={cadence === option.value} onClick={() => setCadence(option.value)}>
              {option.label}
            </SegButton>
          ))}
        </div>
      </div>

      <label className="block space-y-2">
        <span className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-600">Next due</span>
        <input
          type="date"
          value={nextDueDate}
          onChange={(e) => setNextDueDate(e.target.value)}
          aria-label="Next due date"
          className="h-12 w-full rounded-card bg-paper-0 px-4 text-[15px] text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600"
        />
      </label>

      <Button fullWidth size="lg" onClick={handleSave} loading={saving} disabled={!canSave}>
        {isEdit ? 'Save changes' : 'Add recurring'}
      </Button>
    </div>
  )
}

function SegButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex h-11 items-center justify-center rounded-card text-[14px] font-semibold transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600',
        active ? 'bg-coral-100 text-coral-600 ring-1 ring-coral-600' : 'bg-paper-0 text-ink-600',
      )}
    >
      {children}
    </button>
  )
}
