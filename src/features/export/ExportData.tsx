import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { useToast } from '../../components/ui/Toast'
import { toNairobiDateString } from '../transactions/nairobiDate'
import { useAccounts, useCategories, useTransactions } from '../transactions/queries'
import { toCsv, transactionsToCsvRows } from './csv'

/**
 * CSV export (PRD F13). Builds the file from the already-loaded transaction
 * cache (all transactions — no limit) and downloads it client-side. Pure CSV
 * assembly lives in `csv.ts`; this only wires names + the browser download.
 * A BOM is prepended so Excel opens UTF-8 merchant names correctly.
 */
export function ExportData() {
  const { showToast } = useToast()
  const transactionsQuery = useTransactions()
  const accountsQuery = useAccounts()
  const categoriesQuery = useCategories()
  const [building, setBuilding] = useState(false)

  const transactions = transactionsQuery.data ?? []
  const disabled = transactionsQuery.isPending || transactions.length === 0 || building

  const handleExport = () => {
    setBuilding(true)
    try {
      const accountNameById = new Map<string, string>()
      for (const account of accountsQuery.data ?? []) accountNameById.set(account.id, account.name)
      const categoryNameById = new Map<string, string>()
      for (const category of categoriesQuery.data ?? []) categoryNameById.set(category.id, category.name)

      const csv = toCsv(transactionsToCsvRows(transactions, { accountNameById, categoryNameById }))
      // Prepend a UTF-8 BOM (U+FEFF) so spreadsheet apps detect the encoding.
      const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `moneta-transactions-${toNairobiDateString(new Date())}.csv`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      showToast({ title: 'Export ready', variant: 'success' })
    } catch {
      showToast({ title: "Couldn't build the export", variant: 'warn' })
    } finally {
      setBuilding(false)
    }
  }

  return (
    <Card className="space-y-3">
      <div>
        <p className="text-[15px] font-semibold text-ink-900">Export transactions</p>
        <p className="mt-0.5 text-[12.5px] text-ink-600">
          {transactions.length > 0
            ? `Download all ${transactions.length} transactions as a CSV file.`
            : 'Your transactions will be exportable here once you have some.'}
        </p>
      </div>
      <Button variant="secondary" onClick={handleExport} loading={building} disabled={disabled}>
        Download CSV
      </Button>
    </Card>
  )
}
