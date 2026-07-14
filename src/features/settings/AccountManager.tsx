import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { PencilIcon, PlusIcon, TrashIcon } from '../../components/ui/icons'
import { useToast } from '../../components/ui/Toast'
import { accountIcon } from '../transactions/iconMaps'
import { useAccounts } from '../transactions/queries'
import type { Account } from '../transactions/types'
import { AccountEditorSheet } from './AccountEditorSheet'
import { accountTypeLabel } from './accountTypeMeta'
import { ManagerSkeleton } from './ManagerSkeleton'
import { useArchiveAccount, useRestoreAccount } from './mutations'

/**
 * Manage accounts (PRD §7): add a wallet, rename/re-type/re-icon it, or remove
 * it. "Remove" soft-deletes (archives) with an Undo — past transactions on the
 * account are never touched. Mirrors the Transactions delete-with-undo pattern.
 */
export function AccountManager() {
  const { showToast } = useToast()
  const accountsQuery = useAccounts()
  const archiveAccount = useArchiveAccount()
  const restoreAccount = useRestoreAccount()

  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)

  const openCreate = () => {
    setEditing(null)
    setEditorOpen(true)
  }
  const openEdit = (account: Account) => {
    setEditing(account)
    setEditorOpen(true)
  }

  const handleRemove = (account: Account) => {
    archiveAccount.mutate(account.id, {
      onError: () => showToast({ title: "Couldn't remove that", variant: 'warn' }),
    })
    showToast({
      title: 'Removed',
      description: account.name,
      variant: 'info',
      action: {
        label: 'Undo',
        onClick: () =>
          restoreAccount.mutate(account.id, {
            onError: () => showToast({ title: "Couldn't undo that", variant: 'warn' }),
          }),
      },
    })
  }

  const accounts = accountsQuery.data ?? []

  return (
    <>
      <Card className="p-0">
        {accountsQuery.isPending ? (
          <ManagerSkeleton />
        ) : accountsQuery.isError ? (
          <div className="flex items-center justify-between gap-3 px-4 py-4">
            <p className="text-[15px] text-ink-600">Couldn&apos;t load your accounts.</p>
            <Button variant="secondary" onClick={() => void accountsQuery.refetch()}>
              Retry
            </Button>
          </div>
        ) : accounts.length === 0 ? (
          <p className="px-4 py-5 text-[15px] text-ink-600">No accounts yet. Add one to track where your money sits.</p>
        ) : (
          <ul className="divide-y divide-ink-300/40">
            {accounts.map((account) => (
              <li key={account.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-paper-50 text-ink-900">
                  {accountIcon(account)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-ink-900">{account.name}</p>
                  <p className="text-[12.5px] text-ink-600">{accountTypeLabel(account.type)}</p>
                </div>
                <RowButton label={`Edit ${account.name}`} onClick={() => openEdit(account)}>
                  <PencilIcon className="h-5 w-5" />
                </RowButton>
                <RowButton label={`Remove ${account.name}`} onClick={() => handleRemove(account)}>
                  <TrashIcon className="h-5 w-5" />
                </RowButton>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={openCreate}
          className="flex w-full items-center gap-2 border-t border-ink-300/40 px-4 py-3.5 text-[15px] font-semibold text-coral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600"
        >
          <PlusIcon className="h-5 w-5" />
          Add account
        </button>
      </Card>

      <AccountEditorSheet open={editorOpen} onClose={() => setEditorOpen(false)} account={editing} />
    </>
  )
}

function RowButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-ink-600 hover:bg-paper-50 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600"
    >
      {children}
    </button>
  )
}
