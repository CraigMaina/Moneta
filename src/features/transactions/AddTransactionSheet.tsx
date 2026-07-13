import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { CategoryChip } from '../../components/ui/CategoryChip'
import { Keypad } from '../../components/ui/Keypad'
import { Sheet } from '../../components/ui/Sheet'
import { useToast } from '../../components/ui/Toast'
import { cn } from '../../lib/cn'
import { accountIcon, categoryIcon } from './iconMaps'
import { useAccounts, useCategories } from './queries'
import { useAddTransaction } from './mutations'
import { addTransactionSchema } from './schemas'
import type { Account, TransactionKind } from './types'

export interface AddTransactionSheetProps {
  open: boolean
  onClose: () => void
}

const KIND_OPTIONS: { id: TransactionKind; label: string }[] = [
  { id: 'expense', label: 'Expense' },
  { id: 'income', label: 'Income' },
  { id: 'transfer', label: 'Transfer' },
]

function successCopy(kind: TransactionKind): string {
  if (kind === 'income') return 'Logged income'
  if (kind === 'transfer') return 'Logged transfer'
  return 'Logged'
}

/**
 * The 3-second manual-entry sheet (PRD F4). Keypad first, then a kind
 * switcher, then category (hidden for transfers), then the source (+
 * counter, for transfers) account, then an optional note, then "Log it" in
 * the thumb zone. Buttons + handlers only — no `<form>` (CLAUDE.md).
 *
 * The actual form only mounts while `open` is true (see below), so every
 * open gets a fresh `useState` initializer instead of an effect that resets
 * state on open — the idiomatic way to avoid "setState in an effect" for
 * pure derived UI state.
 */
export function AddTransactionSheet({ open, onClose }: AddTransactionSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title="Add transaction">
      {open && <AddTransactionForm onClose={onClose} />}
    </Sheet>
  )
}

function AddTransactionForm({ onClose }: { onClose: () => void }) {
  const { showToast } = useToast()
  const accountsQuery = useAccounts()
  const categoriesQuery = useCategories()
  const addTransaction = useAddTransaction()

  const [kind, setKind] = useState<TransactionKind>('expense')
  const [amountCents, setAmountCents] = useState(0)
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [accountId, setAccountId] = useState<string | null>(null)
  const [counterAccountId, setCounterAccountId] = useState<string | null>(null)
  const [note, setNote] = useState('')

  const accounts = accountsQuery.data ?? []
  const categories = categoriesQuery.data ?? []

  // Everything below is DERIVED at render time from the raw selections above
  // — never synced back into state via an effect — so an invalid selection
  // (a transfer with only one account, a category from the wrong kind, a
  // counter-account that no longer differs from the source) just falls back
  // to a sane default on the next render instead of needing a "fix it up"
  // effect.

  // A transfer needs two distinct accounts to exist at all.
  const canTransfer = accounts.length >= 2
  const kindEffective: TransactionKind = kind === 'transfer' && !canTransfer ? 'expense' : kind

  const accountIdEffective = accounts.some((a) => a.id === accountId) ? accountId : (accounts[0]?.id ?? null)

  const relevantCategories = categories.filter((c) => c.kind === (kindEffective === 'income' ? 'income' : 'expense'))
  const categoryIdEffective =
    kindEffective === 'transfer'
      ? null
      : categoryId && relevantCategories.some((c) => c.id === categoryId)
        ? categoryId
        : null

  const counterAccountOptions = accounts.filter((a) => a.id !== accountIdEffective)
  const counterAccountIdEffective =
    kindEffective === 'transfer'
      ? counterAccountOptions.some((a) => a.id === counterAccountId)
        ? counterAccountId
        : (counterAccountOptions[0]?.id ?? null)
      : null

  const canSubmit =
    amountCents > 0 &&
    Boolean(accountIdEffective) &&
    (kindEffective !== 'transfer' ||
      (Boolean(counterAccountIdEffective) && counterAccountIdEffective !== accountIdEffective)) &&
    !addTransaction.isPending

  const handleSubmit = () => {
    if (!accountIdEffective) return

    const parseResult = addTransactionSchema.safeParse({
      kind: kindEffective,
      amount_cents: amountCents,
      account_id: accountIdEffective,
      counter_account_id: kindEffective === 'transfer' ? counterAccountIdEffective : null,
      category_id: kindEffective === 'transfer' ? null : categoryIdEffective,
      note: note.trim() ? note.trim() : null,
      source: 'manual',
    })

    if (!parseResult.success) {
      showToast({
        title: "That doesn't add up yet",
        description: 'Check the amount and accounts, then try again.',
        variant: 'warn',
      })
      return
    }

    addTransaction.mutate(parseResult.data, {
      onSuccess: () => {
        showToast({ title: successCopy(kindEffective), variant: 'success' })
        onClose()
      },
      onError: () => {
        showToast({
          title: "Couldn't log that",
          description: 'Check your connection and try again.',
          variant: 'warn',
        })
      },
    })
  }

  const accountsUnavailable = accountsQuery.isSuccess && accounts.length === 0

  return (
    <div className="space-y-6">
      <Keypad valueCents={amountCents} onChange={setAmountCents} />

      <KindSegmentedControl value={kindEffective} onChange={setKind} transferDisabled={!canTransfer} />

      {kindEffective !== 'transfer' && (
        <CategorySection
          query={categoriesQuery}
          categories={relevantCategories}
          selectedId={categoryIdEffective}
          onSelect={setCategoryId}
        />
      )}

      {accountsUnavailable ? (
        <div className="rounded-card bg-paper-50 p-4 text-center">
          <p className="text-[15px] font-semibold text-ink-900">No accounts yet</p>
          <p className="mt-1 text-[15px] text-ink-600">
            Set up M-PESA, Cash, or Bank first, then come back to log this.
          </p>
          <Button variant="secondary" onClick={onClose} className="mt-3">
            Close
          </Button>
        </div>
      ) : (
        <>
          <AccountSection
            label={kindEffective === 'transfer' ? 'From' : 'Account'}
            query={accountsQuery}
            accounts={accounts}
            selectedId={accountIdEffective}
            onSelect={setAccountId}
          />

          {kindEffective === 'transfer' && (
            <AccountSection
              label="To"
              query={accountsQuery}
              accounts={counterAccountOptions}
              selectedId={counterAccountIdEffective}
              onSelect={setCounterAccountId}
            />
          )}
        </>
      )}

      <div>
        <label htmlFor="txn-note" className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-600">
          Note (optional)
        </label>
        <input
          id="txn-note"
          type="text"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="What was this for?"
          className="mt-2 h-12 w-full rounded-card bg-paper-50 px-4 text-[15px] text-ink-900 placeholder:text-ink-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600 focus-visible:ring-offset-2 focus-visible:ring-offset-paper-50"
        />
      </div>

      {/* Sticky so "Log it" stays in the thumb zone while the rest scrolls.
          The Sheet root already reserves the safe-area inset past its own
          bottom padding, so this only needs ordinary breathing room. */}
      <div className="sticky bottom-0 -mx-4 -mb-6 bg-paper-50 px-4 pb-4 pt-3">
        <Button fullWidth size="lg" disabled={!canSubmit} loading={addTransaction.isPending} onClick={handleSubmit}>
          Log it
        </Button>
      </div>
    </div>
  )
}

function KindSegmentedControl({
  value,
  onChange,
  transferDisabled,
}: {
  value: TransactionKind
  onChange: (kind: TransactionKind) => void
  transferDisabled: boolean
}) {
  return (
    <div role="group" aria-label="Transaction type" className="flex gap-1 rounded-full bg-paper-50 p-1">
      {KIND_OPTIONS.map((option) => {
        const isDisabled = option.id === 'transfer' && transferDisabled
        const selected = value === option.id
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={selected}
            disabled={isDisabled}
            onClick={() => onChange(option.id)}
            className={cn(
              'h-11 flex-1 rounded-full text-[15px] font-semibold transition-colors duration-150 ease-out',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600 focus-visible:ring-offset-2 focus-visible:ring-offset-paper-50',
              'disabled:cursor-not-allowed disabled:opacity-40',
              selected ? 'bg-paper-0 text-coral-600 shadow-card' : 'text-ink-600',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

interface QueryLikeState {
  isLoading: boolean
  isError: boolean
  refetch: () => void
}

function SectionSkeleton() {
  return (
    <div className="mt-2 flex gap-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-11 w-24 flex-shrink-0 animate-pulse rounded-full bg-paper-50 motion-reduce:animate-none" />
      ))}
    </div>
  )
}

function InlineRetry({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mt-2 flex items-center justify-between gap-3 rounded-card bg-paper-50 px-4 py-3">
      <p className="text-[15px] text-ink-600">{message}</p>
      <Button variant="secondary" size="md" onClick={onRetry}>
        Retry
      </Button>
    </div>
  )
}

function CategorySection({
  query,
  categories,
  selectedId,
  onSelect,
}: {
  query: QueryLikeState
  categories: { id: string; name: string; icon: string | null }[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <div>
      <p className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-600">Category</p>
      {query.isLoading ? (
        <SectionSkeleton />
      ) : query.isError ? (
        <InlineRetry message="Couldn't load categories." onRetry={query.refetch} />
      ) : categories.length === 0 ? (
        <p className="mt-2 text-[15px] text-ink-600">No categories yet — this entry will be uncategorized.</p>
      ) : (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {categories.map((category) => (
            <CategoryChip
              key={category.id}
              icon={categoryIcon(category)}
              label={category.name}
              selected={selectedId === category.id}
              onSelect={() => onSelect(category.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function AccountSection({
  label,
  query,
  accounts,
  selectedId,
  onSelect,
}: {
  label: string
  query: QueryLikeState
  accounts: Account[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <div>
      <p className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-600">{label}</p>
      {query.isLoading ? (
        <SectionSkeleton />
      ) : query.isError ? (
        <InlineRetry message="Couldn't load your accounts." onRetry={query.refetch} />
      ) : accounts.length === 0 ? (
        <p className="mt-2 text-[15px] text-ink-600">No other account to transfer to yet.</p>
      ) : (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {accounts.map((account) => (
            <CategoryChip
              key={account.id}
              icon={accountIcon(account)}
              label={account.name}
              selected={selectedId === account.id}
              onSelect={() => onSelect(account.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
