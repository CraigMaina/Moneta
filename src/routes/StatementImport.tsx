import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { TZDate } from '@date-fns/tz'
import { AmountDisplay } from '../components/ui/AmountDisplay'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { CategoryChip } from '../components/ui/CategoryChip'
import { ArrowRightIcon } from '../components/ui/icons'
import { useToast } from '../components/ui/Toast'
import { cn } from '../lib/cn'
import { NAIROBI_TZ } from '../lib/safeToSpend'
import { useImportStatement } from '../features/import/mutations'
import { parseStatement, type ParseStatementResult, type StatementCandidate } from '../features/import/statementParser'
import { accountIcon } from '../features/transactions/iconMaps'
import { useAccounts, useTransactions } from '../features/transactions/queries'
import type { Account } from '../features/transactions/types'

/**
 * Statement import (PRD F5): paste an M-PESA full-statement's transaction table,
 * review the parsed rows (duplicates already-imported by `mpesa_ref` are flagged
 * and excluded), pick a target account, and import the new ones in one batch.
 * Parsing runs on-device (`parseStatement`); the `import-statement` Edge Function
 * is the deploy-ready path for server-side/PDF parsing (see DECISIONS.md).
 */
export function StatementImport() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const accountsQuery = useAccounts()
  const transactionsQuery = useTransactions()
  const importStatement = useImportStatement()
  const fileRef = useRef<HTMLInputElement>(null)

  const [text, setText] = useState('')
  const [result, setResult] = useState<ParseStatementResult | null>(null)
  const [accountId, setAccountId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const accounts = accountsQuery.data ?? []
  const existingRefs = useMemo(() => {
    const set = new Set<string>()
    for (const txn of transactionsQuery.data ?? []) if (txn.mpesa_ref) set.add(txn.mpesa_ref)
    return set
  }, [transactionsQuery.data])

  const defaultAccountId = useMemo(() => {
    const list = accountsQuery.data ?? []
    const mpesa = list.find((a) => /m-?pesa/i.test(a.name))
    return mpesa?.id ?? list[0]?.id ?? null
  }, [accountsQuery.data])

  const handleParse = () => {
    const parsed = parseStatement(text)
    setResult(parsed)
    // Pre-select every candidate that isn't already imported.
    setSelected(new Set(parsed.candidates.filter((c) => !existingRefs.has(c.mpesaRef)).map((c) => c.mpesaRef)))
    setAccountId((current) => current ?? defaultAccountId)
  }

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    const content = await file.text()
    setText(content)
  }

  const toggle = (ref: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(ref)) next.delete(ref)
      else next.add(ref)
      return next
    })
  }

  const handleImport = () => {
    if (!result || !accountId) return
    const candidates = result.candidates.filter((c) => selected.has(c.mpesaRef))
    if (candidates.length === 0) return
    importStatement.mutate(
      { accountId, candidates },
      {
        onSuccess: ({ inserted, duplicates }) => {
          const dupNote = duplicates > 0 ? ` (${duplicates} already logged)` : ''
          showToast({ title: `Imported ${inserted} transaction${inserted === 1 ? '' : 's'}${dupNote}`, variant: 'success' })
          navigate('/transactions')
        },
        onError: () => showToast({ title: "Couldn't import — try again", variant: 'warn' }),
      },
    )
  }

  const selectedCount = selected.size

  return (
    <main className="min-h-dvh bg-paper-0 pb-24">
      <div className="mx-auto max-w-md px-4 pt-[calc(env(safe-area-inset-top)+16px)]">
        <header className="flex items-center gap-2 py-2">
          <button
            type="button"
            onClick={() => navigate('/settings')}
            aria-label="Back to settings"
            className="flex h-11 w-11 items-center justify-center rounded-full text-ink-600 hover:bg-paper-50 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600"
          >
            <ArrowRightIcon className="h-5 w-5 rotate-180" />
          </button>
          <h1 className="font-display text-[22px] font-semibold text-ink-900">Import statement</h1>
        </header>

        <Card className="mt-2 space-y-3">
          <p className="text-[13px] leading-snug text-ink-600">
            Open your M-PESA full statement, copy the transactions table, and paste it below. We’ll find the
            transactions and let you review them before anything is saved.
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder="Paste your statement here…"
            aria-label="Statement text"
            className="w-full rounded-card bg-paper-0 p-3 text-[13px] text-ink-900 placeholder:text-ink-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600"
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => fileRef.current?.click()}>
              Upload .txt / .csv
            </Button>
            <Button onClick={handleParse} disabled={text.trim().length === 0}>
              Find transactions
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.csv,text/plain,text/csv"
              className="hidden"
              onChange={(e) => void handleFile(e.target.files?.[0])}
            />
          </div>
        </Card>

        {result && <ReviewSection
          result={result}
          existingRefs={existingRefs}
          selected={selected}
          onToggle={toggle}
          accounts={accounts}
          accountId={accountId}
          onSelectAccount={setAccountId}
        />}
      </div>

      {result && result.candidates.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-300/30 bg-paper-0/95 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur">
          <div className="mx-auto flex max-w-md items-center gap-3">
            <p className="flex-1 text-[13px] text-ink-600">
              {selectedCount} selected{accountId ? '' : ' · pick an account'}
            </p>
            <Button
              onClick={handleImport}
              loading={importStatement.isPending}
              disabled={selectedCount === 0 || !accountId}
            >
              Import {selectedCount > 0 ? selectedCount : ''}
            </Button>
          </div>
        </div>
      )}
    </main>
  )
}

function ReviewSection({
  result,
  existingRefs,
  selected,
  onToggle,
  accounts,
  accountId,
  onSelectAccount,
}: {
  result: ParseStatementResult
  existingRefs: Set<string>
  selected: Set<string>
  onToggle: (ref: string) => void
  accounts: Account[]
  accountId: string | null
  onSelectAccount: (id: string) => void
}) {
  if (result.candidates.length === 0) {
    return (
      <Card className="mt-4">
        <p className="text-[15px] font-semibold text-ink-900">No transactions found</p>
        <p className="mt-1 text-[13px] text-ink-600">
          Make sure you pasted the transactions table (with the Receipt No., Completion Time, and amount columns).
        </p>
      </Card>
    )
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="space-y-2">
        <p className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-600">Import into</p>
        <div className="flex flex-wrap gap-2">
          {(accounts ?? []).map((account) => (
            <CategoryChip
              key={account.id}
              icon={accountIcon(account)}
              label={account.name}
              selected={accountId === account.id}
              onSelect={() => onSelectAccount(account.id)}
            />
          ))}
        </div>
      </div>

      <div className="flex items-baseline justify-between">
        <p className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-600">
          {result.candidates.length} found
        </p>
        {(result.skippedStatus > 0 || result.skippedZero > 0) && (
          <p className="text-[12px] text-ink-600">
            {result.skippedStatus + result.skippedZero} skipped
          </p>
        )}
      </div>

      <Card className="divide-y divide-ink-300/40 p-0">
        {result.candidates.map((candidate) => (
          <CandidateRow
            key={candidate.mpesaRef}
            candidate={candidate}
            duplicate={existingRefs.has(candidate.mpesaRef)}
            checked={selected.has(candidate.mpesaRef)}
            onToggle={() => onToggle(candidate.mpesaRef)}
          />
        ))}
      </Card>
    </div>
  )
}

function CandidateRow({
  candidate,
  duplicate,
  checked,
  onToggle,
}: {
  candidate: StatementCandidate
  duplicate: boolean
  checked: boolean
  onToggle: () => void
}) {
  const isIncome = candidate.kind === 'income'
  const label = candidate.merchant ?? candidate.note
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={duplicate}
      aria-pressed={checked}
      className={cn(
        'flex w-full items-center gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600',
        duplicate && 'opacity-50',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border',
          checked ? 'border-coral-600 bg-coral-600 text-white' : 'border-ink-300 bg-paper-0',
        )}
      >
        {checked && (
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
            <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold text-ink-900">{label}</p>
        <p className="mt-0.5 text-[12px] text-ink-600">
          {format(new TZDate(new Date(candidate.occurredAt), NAIROBI_TZ), 'd MMM, HH:mm')}
          {duplicate ? ' · already logged' : ''}
        </p>
      </div>
      <AmountDisplay
        cents={isIncome ? candidate.amountCents : -candidate.amountCents}
        tone={isIncome ? 'income' : 'expense'}
        signed={isIncome}
        size="body"
      />
    </button>
  )
}
