import { useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import { TZDate } from '@date-fns/tz'
import { AmountDisplay } from '../../components/ui/AmountDisplay'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { CategoryChip } from '../../components/ui/CategoryChip'
import { useToast } from '../../components/ui/Toast'
import { cn } from '../../lib/cn'
import { NAIROBI_TZ } from '../../lib/safeToSpend'
import { accountIcon } from '../transactions/iconMaps'
import { useAccounts, useTransactions } from '../transactions/queries'
import type { Account } from '../transactions/types'
import { useImportStatement, type ImportStatementResult } from './mutations'
import { parseStatement, type ParseStatementResult, type StatementCandidate } from './statementParser'

/**
 * Reusable statement-import surface (PRD F5), shared by the `/import` route and
 * the onboarding backfill step so both parse, review, and import identically.
 * Paste (or upload text) → review the parsed rows (already-imported ones are
 * flagged from cache and excluded) → pick the account → deduped batch import.
 * The in/out summary lets the user see where they stand before importing.
 */
export function StatementImportPanel({
  onImported,
  importLabel = 'Import',
}: {
  onImported?: (result: ImportStatementResult) => void
  importLabel?: string
}) {
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
    setSelected(new Set(parsed.candidates.filter((c) => !existingRefs.has(c.mpesaRef)).map((c) => c.mpesaRef)))
    setAccountId((current) => current ?? defaultAccountId)
  }

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setText(await file.text())
  }

  const toggle = (ref: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(ref)) next.delete(ref)
      else next.add(ref)
      return next
    })
  }

  const selectedCandidates = result?.candidates.filter((c) => selected.has(c.mpesaRef)) ?? []
  const totals = useMemo(() => {
    let inCents = 0
    let outCents = 0
    for (const c of selectedCandidates) {
      if (c.kind === 'income') inCents += c.amountCents
      else outCents += c.amountCents
    }
    return { inCents, outCents }
  }, [selectedCandidates])

  const handleImport = () => {
    if (!accountId || selectedCandidates.length === 0) return
    importStatement.mutate(
      { accountId, candidates: selectedCandidates },
      {
        onSuccess: (res) => {
          const dupNote = res.duplicates > 0 ? ` (${res.duplicates} already logged)` : ''
          showToast({
            title: `Imported ${res.inserted} transaction${res.inserted === 1 ? '' : 's'}${dupNote}`,
            variant: 'success',
          })
          onImported?.(res)
        },
        onError: () => showToast({ title: "Couldn't import — try again", variant: 'warn' }),
      },
    )
  }

  return (
    <div className="space-y-5">
      <Card className="space-y-3">
        <p className="text-[13px] leading-snug text-ink-600">
          Open your M-PESA full statement, select the transactions table, and paste it here. We’ll find the
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

      {result && result.candidates.length === 0 && (
        <Card>
          <p className="text-[15px] font-semibold text-ink-900">No transactions found</p>
          <p className="mt-1 text-[13px] text-ink-600">
            Make sure you pasted the transactions table (with the Receipt No., Completion Time, and amount columns).
          </p>
        </Card>
      )}

      {result && result.candidates.length > 0 && (
        <>
          <div className="space-y-2">
            <p className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-600">Import into</p>
            <div className="flex flex-wrap gap-2">
              {accounts.map((account: Account) => (
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

          <div className="rounded-card bg-paper-50 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-600">Money in</span>
              <AmountDisplay cents={totals.inCents} tone="income" signed size="body" />
            </div>
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-600">Money out</span>
              <AmountDisplay cents={-totals.outCents} tone="expense" size="body" />
            </div>
          </div>

          <div className="flex items-baseline justify-between">
            <p className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-600">
              {result.candidates.length} found
            </p>
            {result.skippedStatus + result.skippedZero > 0 && (
              <p className="text-[12px] text-ink-600">{result.skippedStatus + result.skippedZero} skipped</p>
            )}
          </div>

          <Card className="divide-y divide-ink-300/40 p-0">
            {result.candidates.map((candidate) => (
              <CandidateRow
                key={candidate.mpesaRef}
                candidate={candidate}
                duplicate={existingRefs.has(candidate.mpesaRef)}
                checked={selected.has(candidate.mpesaRef)}
                onToggle={() => toggle(candidate.mpesaRef)}
              />
            ))}
          </Card>

          <Button
            fullWidth
            size="lg"
            onClick={handleImport}
            loading={importStatement.isPending}
            disabled={selectedCandidates.length === 0 || !accountId}
          >
            {importLabel}
            {selectedCandidates.length > 0 ? ` ${selectedCandidates.length}` : ''}
          </Button>
        </>
      )}
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
