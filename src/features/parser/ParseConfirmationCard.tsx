import { useState } from 'react'
import { AmountDisplay } from '../../components/ui/AmountDisplay'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { CategoryChip } from '../../components/ui/CategoryChip'
import { Keypad } from '../../components/ui/Keypad'
import { ArrowRightIcon } from '../../components/ui/icons'
import { cn } from '../../lib/cn'
import { formatKES } from '../../lib/money'
import type { CategoryName, ParsedMpesaMessage, TransactionKind } from '../../parser/types'
import { accountTypeIcon, categoryNameIcon, pickCategoryIcon } from './categoryIcons'
import { formatOccurredAt } from './dateFormat'
import {
  FEE_CATEGORY_NAME,
  amountTone,
  familyTitle,
  resolveDefaultAccounts,
  transferHeadline,
  type AccountOption,
} from './parseConfirmationLogic'

export type { AccountOption } from './parseConfirmationLogic'

/** The payload `onConfirm` receives — everything the lead needs to build the (1 or 2) row insert(s) per the row-splitting rule in `parser/types.ts`. */
export interface ParseConfirmationEdits {
  amountCents: number
  kind: TransactionKind
  merchant: string | null
  note: string
  /** Always `null` for a transfer (schema invariant — transfers never carry a category). */
  category: CategoryName | null
  accountId: string | null
  /** Set only when `kind === 'transfer'`. */
  counterAccountId: string | null
  /** Echoes `parsed.feeCents` — 0 means no separate fee row is needed. */
  feeCents: number
  /** The account the fee is debited from (always M-PESA, per the row-splitting rule) — `null` when there's no fee. */
  feeAccountId: string | null
}

export interface ParseConfirmationCardProps {
  parsed: ParsedMpesaMessage
  /** Known accounts, used to pre-select and let the user re-pick which account(s) this row touches. Presentational only — the lead supplies these (e.g. from `useAccounts()`). Omit while accounts are still loading; the card degrades to a quiet "No accounts yet" row rather than guessing. */
  accounts?: AccountOption[]
  /**
   * Controlled category override. Defaults to `parsed.category` when
   * omitted (`undefined`) — pass `null` explicitly once the user has cleared
   * it, or a `CategoryName` once they've picked one. The card never owns
   * category-picker UI itself; `onEditCategory` opens that (lead-owned)
   * sheet, and the lead re-renders this prop with the result.
   */
  category?: CategoryName | null
  onConfirm: (edits: ParseConfirmationEdits) => void
  onEditCategory: () => void
  /** Renders the "Sync M-PESA balance" affordance when provided AND `parsed.newBalanceCents` is present. Omit to hide it entirely. */
  onSyncBalance?: () => void
  onCancel: () => void
  /** Disables + shows a spinner on "Log it" (e.g. while the save mutation is in flight). */
  saving?: boolean
  className?: string
}

/**
 * The editable parse-confirmation card (PRD F2). Renders truthfully off the
 * `ParsedMpesaMessage` contract:
 *  - a transfer (withdrawal/deposit/Fuliza/M-Shwari) shows an account-to-
 *    account headline ("M-PESA -> Cash"), never a merchant/expense line, and
 *    never borrows the expense tone (see `amountTone` in
 *    `parseConfirmationLogic.ts`);
 *  - a fee rides as its own line, since it becomes its own expense row;
 *  - a `null` category shows a "Pick a category" prompt chip;
 *  - `newBalanceCents` offers a one-tap sync, only when `onSyncBalance` is
 *    wired.
 * Pure presentational component: no data hooks, no mutation — every action
 * is a callback prop. Buttons + handlers only, no `<form>` (CLAUDE.md).
 */
export function ParseConfirmationCard({
  parsed,
  accounts = [],
  category,
  onConfirm,
  onEditCategory,
  onSyncBalance,
  onCancel,
  saving = false,
  className,
}: ParseConfirmationCardProps) {
  const [amountCents, setAmountCents] = useState(parsed.amountCents)
  const [editingAmount, setEditingAmount] = useState(false)
  const [kind, setKind] = useState<TransactionKind>(parsed.kind)
  const [merchant, setMerchant] = useState(parsed.merchant ?? '')
  const [note, setNote] = useState('')
  const [accountId, setAccountId] = useState<string | null>(null)
  const [counterAccountId, setCounterAccountId] = useState<string | null>(null)

  const isTransferFamily = parsed.kind === 'transfer'
  const isReversal = parsed.family === 'reversal'
  const categoryEffective = category !== undefined ? category : parsed.category

  const resolved = resolveDefaultAccounts(parsed, accounts)
  const accountIdEffective = accounts.some((a) => a.id === accountId) ? accountId : resolved.accountId
  const counterOptions = accounts.filter((a) => a.id !== accountIdEffective)
  const counterAccountIdEffective =
    kind === 'transfer'
      ? counterOptions.some((a) => a.id === counterAccountId)
        ? counterAccountId
        : resolved.counterAccountId
      : null

  const headline = transferHeadline(parsed, resolved, accounts)

  const canSubmit = amountCents > 0 && !saving

  const handleConfirm = () => {
    onConfirm({
      amountCents,
      kind,
      merchant: merchant.trim() ? merchant.trim() : null,
      note: note.trim(),
      category: kind === 'transfer' ? null : categoryEffective,
      accountId: accountIdEffective,
      counterAccountId: kind === 'transfer' ? counterAccountIdEffective : null,
      feeCents: parsed.feeCents,
      feeAccountId: parsed.feeCents > 0 ? resolved.accountId : null,
    })
  }

  return (
    <Card className={cn('space-y-5', className)}>
      <div>
        <p className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-600">{familyTitle(parsed.family)}</p>
        {editingAmount ? (
          <div className="mt-3">
            <Keypad valueCents={amountCents} onChange={setAmountCents} />
            <Button variant="ghost" size="md" onClick={() => setEditingAmount(false)} className="mt-2">
              Done
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditingAmount(true)}
            aria-label="Edit amount"
            className="mt-2 block rounded-card text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600 focus-visible:ring-offset-2 focus-visible:ring-offset-paper-0"
          >
            <AmountDisplay cents={amountCents} size="hero" tone={amountTone(kind)} />
          </button>
        )}
      </div>

      {headline ? (
        <div className="space-y-1" data-testid="transfer-headline">
          <div className="flex items-center gap-2 text-[15px] font-semibold text-ink-900">
            <span>{headline.fromLabel}</span>
            <ArrowRightIcon className="h-4 w-4 flex-shrink-0 text-ink-600" />
            <span>{headline.toLabel}</span>
          </div>
          {parsed.merchant && <p className="text-[13px] text-ink-600">via {parsed.merchant}</p>}
        </div>
      ) : isReversal ? (
        <div className="rounded-card bg-paper-50 p-3">
          <p className="text-[15px] font-semibold text-ink-900">Reverses a transaction</p>
          <p className="mt-1 text-[13px] text-ink-600">
            We&apos;ll match this against M-PESA ref{' '}
            <span className="font-semibold text-ink-900">{parsed.reversalOfRef}</span> and cancel it out.
          </p>
        </div>
      ) : (
        <div>
          <label htmlFor="pc-merchant" className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-600">
            {kind === 'income' ? 'From' : 'Paid to'}
          </label>
          <input
            id="pc-merchant"
            type="text"
            value={merchant}
            onChange={(event) => setMerchant(event.target.value)}
            placeholder="Who was this?"
            className="mt-2 h-12 w-full rounded-card bg-paper-50 px-4 text-[15px] text-ink-900 placeholder:text-ink-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600 focus-visible:ring-offset-2 focus-visible:ring-offset-paper-0"
          />
        </div>
      )}

      {!isTransferFamily && <KindToggle value={kind} onChange={setKind} />}

      {!isTransferFamily && (
        <div>
          <p className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-600">Category</p>
          <div className="mt-2">
            {categoryEffective ? (
              <CategoryChip
                icon={categoryNameIcon(categoryEffective)}
                label={categoryEffective}
                selected
                onSelect={onEditCategory}
              />
            ) : (
              <CategoryChip icon={pickCategoryIcon()} label="Pick a category" selected={false} onSelect={onEditCategory} />
            )}
          </div>
        </div>
      )}

      {!isReversal && (
        <div className="space-y-4">
          <AccountPicker
            label={kind === 'transfer' ? 'From' : 'Account'}
            accounts={accounts}
            selectedId={accountIdEffective}
            onSelect={setAccountId}
          />
          {kind === 'transfer' && (
            <AccountPicker label="To" accounts={counterOptions} selectedId={counterAccountIdEffective} onSelect={setCounterAccountId} />
          )}
        </div>
      )}

      {parsed.feeCents > 0 && (
        <div className="flex items-center justify-between rounded-card bg-paper-50 px-4 py-3">
          <div>
            <p className="text-[15px] font-semibold text-ink-900">Fee</p>
            <p className="text-[12.5px] text-ink-600">Its own expense, in {FEE_CATEGORY_NAME}</p>
          </div>
          <AmountDisplay cents={parsed.feeCents} size="body" tone="expense" />
        </div>
      )}

      <p className="text-[13px] text-ink-600">{formatOccurredAt(parsed.occurredAt)}</p>

      <div>
        <label htmlFor="pc-note" className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-600">
          Note (optional)
        </label>
        <input
          id="pc-note"
          type="text"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Add a note"
          className="mt-2 h-12 w-full rounded-card bg-paper-50 px-4 text-[15px] text-ink-900 placeholder:text-ink-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600 focus-visible:ring-offset-2 focus-visible:ring-offset-paper-0"
        />
      </div>

      {parsed.newBalanceCents !== null && onSyncBalance && (
        <div className="flex items-center justify-between gap-3 rounded-card bg-coral-100 px-4 py-3">
          <div>
            <p className="text-[15px] font-semibold text-ink-900">New M-PESA balance</p>
            <p className="text-[13px] text-ink-600">{formatKES(parsed.newBalanceCents)}, reported by Safaricom</p>
          </div>
          <Button variant="secondary" size="md" onClick={onSyncBalance}>
            Sync balance
          </Button>
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <Button variant="ghost" size="lg" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button size="lg" disabled={!canSubmit} loading={saving} onClick={handleConfirm} className="flex-1">
          Log it
        </Button>
      </div>
    </Card>
  )
}

function KindToggle({ value, onChange }: { value: TransactionKind; onChange: (kind: TransactionKind) => void }) {
  const options: { id: TransactionKind; label: string }[] = [
    { id: 'expense', label: 'Expense' },
    { id: 'income', label: 'Income' },
  ]
  return (
    <div role="group" aria-label="Transaction type" className="flex gap-1 rounded-full bg-paper-50 p-1">
      {options.map((option) => {
        const selected = value === option.id
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.id)}
            className={cn(
              'h-11 flex-1 rounded-full text-[15px] font-semibold transition-colors duration-150 ease-out',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600 focus-visible:ring-offset-2 focus-visible:ring-offset-paper-50',
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

function AccountPicker({
  label,
  accounts,
  selectedId,
  onSelect,
}: {
  label: string
  accounts: AccountOption[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <div>
      <p className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-600">{label}</p>
      {accounts.length === 0 ? (
        <p className="mt-2 text-[13px] text-ink-600">No accounts yet.</p>
      ) : (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {accounts.map((account) => (
            <CategoryChip
              key={account.id}
              icon={accountTypeIcon(account.type)}
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
