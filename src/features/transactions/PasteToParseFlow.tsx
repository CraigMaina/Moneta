import { useMemo, useState } from 'react'
import { CategoryChip } from '../../components/ui/CategoryChip'
import { useToast } from '../../components/ui/Toast'
import {
  ParseConfirmationCard,
  type AccountOption,
  type ParseConfirmationEdits,
} from '../parser/ParseConfirmationCard'
import { ParseTransform } from '../parser/ParseTransform'
import { PasteToParse } from '../parser/PasteToParse'
import { categoryNameIcon } from '../parser/categoryIcons'
import { CATEGORY_NAMES, normalizeMerchant, resolveMerchantCategory } from '../../parser'
import { INCOME_CATEGORY_NAMES, type CategoryName } from '../../parser/types'
import { buildParsedRows } from './buildParsedRows'
import { useMerchantRules, useSetMerchantRule } from './merchantMemory'
import { useReconcileBalance, useReverseTransaction, useSaveParsedTransactions } from './mutations'
import { useAccounts, useCategories } from './queries'
import { useParseMessage, type ParseOutcome } from './useParseMessage'

/**
 * Paste → parse → confirm → save (PRD §F2), the lead-owned integration that
 * composes the design layer's presentational pieces with the data layer:
 *
 *   PasteToParse ──▶ useParseMessage (deterministic, then Edge fallback)
 *        │ matched                       │ manual
 *        ▼                               ▼
 *   ParseConfirmationCard (in         onFallbackToManual() — hand off to the
 *   ParseTransform) ──▶ onConfirm      keypad sheet, prefilled elsewhere
 *        ▼
 *   useSaveParsedTransactions (1–2 rows, mpesa_ref-deduped) + merchant memory
 *
 * Deferred (surfaced to the lead, not silently dropped): reversal auto-matching
 * (needs the negate-original mutation) and the balance-reconciliation sync
 * (`onSyncBalance`) — both are flagged here rather than faked.
 */

export interface PasteToParseFlowProps {
  onClose: () => void
  /** Switch the parent Add sheet back to manual keypad entry (the "enter manually" fallback). */
  onFallbackToManual: () => void
  /** Pre-filled shared text (Web Share Target) — auto-parsed on mount when present. */
  initialText?: string
}

function toAccountOptions(accounts: { id: string; name: string; type: AccountOption['type'] }[]): AccountOption[] {
  return accounts.map((a) => ({ id: a.id, name: a.name, type: a.type }))
}

export function PasteToParseFlow({ onClose, onFallbackToManual, initialText }: PasteToParseFlowProps) {
  const { showToast } = useToast()
  const accountsQuery = useAccounts()
  const categoriesQuery = useCategories()
  const merchantRulesQuery = useMerchantRules()
  const parseMessage = useParseMessage()
  const saveParsed = useSaveParsedTransactions()
  const reverseTransaction = useReverseTransaction()
  const reconcileBalance = useReconcileBalance()
  const setMerchantRule = useSetMerchantRule()

  const [outcome, setOutcome] = useState<ParseOutcome | null>(null)
  const [category, setCategory] = useState<CategoryName | null | undefined>(undefined)
  const [editingCategory, setEditingCategory] = useState(false)
  const [syncRequested, setSyncRequested] = useState(false)

  const accountOptions = useMemo(() => toAccountOptions(accountsQuery.data ?? []), [accountsQuery.data])
  const categoryIdByName = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of categoriesQuery.data ?? []) map.set(c.name, c.id)
    return map
  }, [categoriesQuery.data])

  const runParse = (text: string) => {
    parseMessage.mutate(text, {
      onSuccess: (result) => {
        setOutcome(result)
        if (result.status === 'matched') {
          // Seed the category from merchant memory, if the user has a rule for this merchant.
          const merchant = result.data.merchant
          const rule = merchant
            ? resolveMerchantCategory(normalizeMerchant(merchant), merchantRulesQuery.data ?? [])
            : null
          setCategory(rule ? (rule as CategoryName) : undefined)
          setEditingCategory(false)
        }
      },
    })
  }

  // Auto-parse shared text once on mount.
  const [autoParsed, setAutoParsed] = useState(false)
  if (initialText && !autoParsed && !outcome && !parseMessage.isPending) {
    setAutoParsed(true)
    runParse(initialText)
  }

  const pasteStatus: 'idle' | 'pending' | 'error' = parseMessage.isPending
    ? 'pending'
    : outcome?.status === 'manual'
      ? 'error'
      : 'idle'

  // ---- Stage 1: paste (or a manual/unparseable fallback) ----
  if (!outcome || outcome.status === 'manual') {
    return (
      <PasteToParse
        onParse={runParse}
        status={pasteStatus}
        errorMessage="We couldn't read that message. You can enter it by hand instead."
        onEnterManually={onFallbackToManual}
      />
    )
  }

  const parsed = outcome.data

  // ---- Category picker (opened by the card's onEditCategory) ----
  if (editingCategory) {
    const incomeSide = parsed.kind === 'income'
    const pickable = CATEGORY_NAMES.filter((name) => INCOME_CATEGORY_NAMES.has(name) === incomeSide)
    return (
      <div className="space-y-4">
        <p className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-600">Pick a category</p>
        <div className="flex flex-wrap gap-2">
          {pickable.map((name) => (
            <CategoryChip
              key={name}
              icon={categoryNameIcon(name)}
              label={name}
              selected={category === name}
              onSelect={() => {
                setCategory(name)
                setEditingCategory(false)
              }}
            />
          ))}
        </div>
      </div>
    )
  }

  // ---- Stage 2: confirm ----
  const handleConfirm = (edits: ParseConfirmationEdits) => {
    if (parsed.family === 'reversal') {
      // Match the original by ref and cancel it out — never book the reversal
      // as a fresh income/expense (PRD §4.5 "the number never lies").
      if (!parsed.reversalOfRef) {
        showToast({ title: "Couldn't read the reversal", variant: 'warn' })
        onClose()
        return
      }
      reverseTransaction.mutate(parsed.reversalOfRef, {
        onSuccess: ({ found, reversedCount }) => {
          if (found) {
            const plural = reversedCount === 1 ? 'entry' : 'entries'
            showToast({ title: 'Reversed', description: `Cancelled out ${reversedCount} ${plural}.`, variant: 'success' })
          } else {
            showToast({
              title: "Couldn't find the original",
              description: "We don't have that transaction. Adjust it by hand if you need to.",
              variant: 'warn',
            })
          }
          onClose()
        },
        onError: () => showToast({ title: "Couldn't reverse that", description: 'Try again.', variant: 'warn' }),
      })
      return
    }
    if (!edits.accountId) {
      showToast({ title: 'Pick an account first', variant: 'warn' })
      return
    }

    const rows = buildParsedRows(parsed, edits, categoryIdByName)
    saveParsed.mutate(rows, {
      onSuccess: ({ duplicated, inserted }) => {
        if (duplicated && inserted.length === 0) {
          showToast({ title: 'Already logged', description: 'This message was saved before.', variant: 'info' })
        } else {
          showToast({ title: 'Saved', variant: 'success' })
          rememberMerchantCorrection(edits)
        }
        maybeSyncBalance()
        onClose()
      },
      onError: () => {
        showToast({ title: "Couldn't save that", description: 'Check your connection and try again.', variant: 'warn' })
      },
    })
  }

  // If the user armed "Sync balance", reconcile M-PESA to Safaricom's reported
  // figure AFTER the parsed transaction is saved (so the sync accounts for it).
  const mpesaAccountId = accountOptions.find((a) => a.type === 'mpesa')?.id ?? null
  const maybeSyncBalance = () => {
    if (!syncRequested || parsed.newBalanceCents === null || !mpesaAccountId) return
    reconcileBalance.mutate(
      { accountId: mpesaAccountId, targetBalanceCents: parsed.newBalanceCents },
      {
        onSuccess: ({ adjusted }) => {
          if (adjusted) showToast({ title: 'M-PESA balance synced', variant: 'success' })
        },
      },
    )
  }

  const rememberMerchantCorrection = (edits: ParseConfirmationEdits) => {
    // Only when the user actually changed the category away from the parser's guess.
    if (edits.kind === 'transfer' || !edits.category || !edits.merchant) return
    if (edits.category === parsed.category) return
    const categoryId = categoryIdByName.get(edits.category)
    if (!categoryId) return
    setMerchantRule.mutate({ merchantNormalized: normalizeMerchant(edits.merchant), categoryId })
  }

  return (
    <ParseTransform rawText={parsed.rawText} parsed>
      <ParseConfirmationCard
        parsed={parsed}
        accounts={accountOptions}
        category={category}
        onConfirm={handleConfirm}
        onEditCategory={() => setEditingCategory(true)}
        onSyncBalance={
          parsed.newBalanceCents !== null && mpesaAccountId
            ? () => {
                setSyncRequested(true)
                showToast({
                  title: 'Balance will sync',
                  description: "We'll match M-PESA to Safaricom's figure when you save.",
                  variant: 'info',
                })
              }
            : undefined
        }
        onCancel={onClose}
        saving={saveParsed.isPending || reverseTransaction.isPending}
      />
    </ParseTransform>
  )
}
