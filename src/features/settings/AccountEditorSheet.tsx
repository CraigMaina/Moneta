import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Sheet } from '../../components/ui/Sheet'
import { useToast } from '../../components/ui/Toast'
import { cn } from '../../lib/cn'
import type { Account } from '../transactions/types'
import { EmojiPicker } from './EmojiPicker'
import { isDuplicateNameError, useCreateAccount, useUpdateAccount } from './mutations'
import { ACCOUNT_TYPES, type AccountTypeValue } from './accountTypeMeta'

/**
 * Add or edit an account (PRD §7). Create shows the type picker; edit keeps it
 * (a wallet's type can change, e.g. re-typing a generic "Savings" from other →
 * bank). No `<form>` — CLAUDE.md forbids form submission inside sheets, so it's
 * buttons + handlers throughout.
 */
export interface AccountEditorSheetProps {
  open: boolean
  onClose: () => void
  /** Present = edit that account; absent/null = create a new one. */
  account?: Account | null
}

export function AccountEditorSheet({ open, onClose, account }: AccountEditorSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title={account ? 'Edit account' : 'New account'}>
      {/* Body only mounts while open, so each open gets fresh useState
          initializers seeded from `account` — the idiomatic way to reset form
          state on open without a setState-in-effect (see AddTransactionSheet). */}
      {open && <AccountEditorBody account={account} onClose={onClose} />}
    </Sheet>
  )
}

function AccountEditorBody({ account, onClose }: { account?: Account | null; onClose: () => void }) {
  const { showToast } = useToast()
  const createAccount = useCreateAccount()
  const updateAccount = useUpdateAccount()
  const isEdit = Boolean(account)

  const [name, setName] = useState(account?.name ?? '')
  const [type, setType] = useState<AccountTypeValue>((account?.type as AccountTypeValue | undefined) ?? 'cash')
  const [icon, setIcon] = useState<string | null>(account?.icon ?? null)

  const saving = createAccount.isPending || updateAccount.isPending
  const canSave = name.trim().length > 0 && !saving

  const handleSave = () => {
    if (!canSave) return
    const onError = (error: unknown) =>
      showToast({
        title: isDuplicateNameError(error) ? 'You already have an account with that name' : "Couldn't save that",
        variant: 'warn',
      })

    if (account) {
      updateAccount.mutate(
        { id: account.id, patch: { name: name.trim(), type, icon } },
        {
          onSuccess: () => {
            showToast({ title: 'Saved', variant: 'success' })
            onClose()
          },
          onError,
        },
      )
    } else {
      createAccount.mutate(
        { name: name.trim(), type, icon },
        {
          onSuccess: () => {
            showToast({ title: 'Account added', variant: 'success' })
            onClose()
          },
          onError,
        },
      )
    }
  }

  return (
    <div className="space-y-5">
      <label className="block space-y-2">
        <span className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-600">Name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Equity, Cash, Sacco"
          aria-label="Account name"
          className="h-12 w-full rounded-card bg-paper-0 px-4 text-[15px] text-ink-900 placeholder:text-ink-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600"
        />
      </label>

      <div className="space-y-2">
        <span className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-600">Type</span>
        <div className="grid grid-cols-4 gap-1.5">
          {ACCOUNT_TYPES.map((option) => {
            const active = type === option.value
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => setType(option.value)}
                className={cn(
                  'flex h-11 items-center justify-center rounded-card text-[14px] font-semibold transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600',
                  active ? 'bg-coral-100 text-coral-600 ring-1 ring-coral-600' : 'bg-paper-0 text-ink-600',
                )}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-600">Icon (optional)</span>
        <EmojiPicker value={icon} onChange={setIcon} />
      </div>

      <Button fullWidth size="lg" onClick={handleSave} loading={saving} disabled={!canSave}>
        {isEdit ? 'Save changes' : 'Add account'}
      </Button>
    </div>
  )
}
