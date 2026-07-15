import { toNairobiDateString } from '../transactions/nairobiDate'
import type { Transaction } from '../transactions/types'

/**
 * Client-side CSV export (PRD F13), RFC 4180. Pure and unit-tested: rows in,
 * a spec-compliant CSV string out. The download plumbing lives in the component.
 *
 * Money is exported as a plain decimal string derived from integer cents with
 * integer math only (no float) — this is a display edge, so `amount_cents`
 * becomes e.g. "1450.00" without thousands separators (which would collide with
 * the CSV comma). Amounts stay positive; `kind` carries direction (CLAUDE.md).
 */

/** Integer cents → "1450.00" using integer math only (never a float divide). */
export function centsToDecimalString(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const whole = Math.trunc(abs / 100)
  const frac = abs % 100
  return `${sign}${whole}.${String(frac).padStart(2, '0')}`
}

/** Escape one field per RFC 4180: quote when it contains a comma, quote, CR or LF; double internal quotes. */
export function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/** Join rows into an RFC 4180 CSV string (CRLF line endings, no trailing newline). */
export function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(escapeCsvField).join(',')).join('\r\n')
}

export interface TransactionCsvContext {
  accountNameById: Map<string, string>
  categoryNameById: Map<string, string>
}

export const TRANSACTION_CSV_HEADER = [
  'Date',
  'Kind',
  'Amount',
  'Currency',
  'Account',
  'Counter account',
  'Category',
  'Merchant',
  'Note',
  'M-PESA ref',
] as const

/** Build header + data rows for the transaction export, newest first (as fetched). */
export function transactionsToCsvRows(transactions: Transaction[], ctx: TransactionCsvContext): string[][] {
  const rows: string[][] = [[...TRANSACTION_CSV_HEADER]]
  for (const txn of transactions) {
    rows.push([
      toNairobiDateString(new Date(txn.occurred_at)),
      txn.kind,
      centsToDecimalString(txn.amount_cents),
      'KES',
      ctx.accountNameById.get(txn.account_id) ?? '',
      txn.counter_account_id ? (ctx.accountNameById.get(txn.counter_account_id) ?? '') : '',
      txn.category_id ? (ctx.categoryNameById.get(txn.category_id) ?? '') : '',
      txn.merchant ?? '',
      txn.note ?? '',
      txn.mpesa_ref ?? '',
    ])
  }
  return rows
}
