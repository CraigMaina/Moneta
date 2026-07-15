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

  // PDF path (lazy pdf.js): extraction status + password-protected flow.
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [pdfPassword, setPdfPassword] = useState('')
  const [needsPassword, setNeedsPassword] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const [extracting, setExtracting] = useState(false)

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

  const parseAndShow = (source: string) => {
    const parsed = parseStatement(source)
    setResult(parsed)
    setSelected(new Set(parsed.candidates.filter((c) => !existingRefs.has(c.mpesaRef)).map((c) => c.mpesaRef)))
    setAccountId((current) => current ?? defaultAccountId)
  }

  const handleParse = () => parseAndShow(text)

  const runPdfExtraction = async (file: File, password?: string) => {
    setExtracting(true)
    setPdfError(null)
    try {
      const { extractPdfText } = await import('./pdfText')
      const extracted = await extractPdfText(file, password)
      setText(extracted)
      setNeedsPassword(false)
      setPdfFile(null)
      setPdfPassword('')
      if (extracted.trim().length === 0) {
        // A text layer we couldn't read anything from — almost always a scanned
        // / image-only PDF rather than a real text statement.
        setPdfError('We couldn’t read any text from that PDF — it may be a scanned image rather than a text statement.')
        setResult({ candidates: [], skippedZero: 0, skippedStatus: 0 })
        return
      }
      parseAndShow(extracted)
    } catch (error) {
      const { PdfPasswordError } = await import('./pdfText')
      if (error instanceof PdfPasswordError) {
        setPdfFile(file)
        setNeedsPassword(true)
        setPdfError(error.incorrect ? 'That password didn’t work. Try again.' : null)
      } else {
        setPdfFile(null)
        setNeedsPassword(false)
        setPdfError('Couldn’t read that PDF. Try pasting the statement text instead.')
      }
    } finally {
      setExtracting(false)
    }
  }

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
    if (isPdf) {
      setNeedsPassword(false)
      setPdfPassword('')
      await runPdfExtraction(file)
    } else {
      setPdfError(null)
      setNeedsPassword(false)
      setText(await file.text())
    }
  }

  const submitPassword = async () => {
    if (pdfFile) await runPdfExtraction(pdfFile, pdfPassword)
  }

  const toggle = (ref: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(ref)) next.delete(ref)
      else next.add(ref)
      return next
    })
  }

  const selectedCandidates = useMemo(
    () => result?.candidates.filter((c) => selected.has(c.mpesaRef)) ?? [],
    [result, selected],
  )
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
          Upload your M-PESA statement PDF — we’ll read it on your device — or paste the transactions table below.
          You’ll review everything before anything is saved.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder="…or paste your statement here"
          aria-label="Statement text"
          className="w-full rounded-card bg-paper-0 p-3 text-[13px] text-ink-900 placeholder:text-ink-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600"
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => fileRef.current?.click()} loading={extracting}>
            Upload PDF / .txt / .csv
          </Button>
          <Button onClick={handleParse} disabled={text.trim().length === 0}>
            Find transactions
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.txt,.csv,application/pdf,text/plain,text/csv"
            className="hidden"
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />
        </div>

        {extracting && <p className="text-[13px] text-ink-600">Reading your statement…</p>}

        {needsPassword && (
          <div className="space-y-2 rounded-card bg-paper-0 p-3">
            <p className="text-[13px] text-ink-600">
              This statement is password-protected. Enter the password M-PESA sent to your phone — it stays on your
              device.
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                value={pdfPassword}
                onChange={(e) => setPdfPassword(e.target.value)}
                autoComplete="off"
                aria-label="Statement password"
                placeholder="Statement password"
                className="h-11 flex-1 rounded-card bg-paper-50 px-3 text-[14px] text-ink-900 placeholder:text-ink-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600"
              />
              <Button onClick={() => void submitPassword()} loading={extracting} disabled={pdfPassword.length === 0}>
                Unlock
              </Button>
            </div>
            {pdfError && <p className="text-[12.5px] text-coral-600">{pdfError}</p>}
          </div>
        )}

        {pdfError && !needsPassword && <p className="text-[12.5px] text-coral-600">{pdfError}</p>}
      </Card>

      {result && result.candidates.length === 0 && (
        <Card>
          <p className="text-[15px] font-semibold text-ink-900">No transactions found</p>
          <p className="mt-1 text-[13px] text-ink-600">
            Make sure the transactions table is included (with the Receipt No., Completion Time, and amount columns).
          </p>
          {text.trim().length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-[13px] font-semibold text-coral-600">
                View extracted text ({text.length.toLocaleString()} characters)
              </summary>
              <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-card bg-paper-50 p-3 text-[11px] leading-snug text-ink-900">
                {text}
              </pre>
              <Button
                variant="secondary"
                onClick={() => void navigator.clipboard?.writeText(text)}
                className="mt-2"
              >
                Copy extracted text
              </Button>
            </details>
          )}
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
