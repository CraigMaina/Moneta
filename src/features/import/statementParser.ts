import { TZDate } from '@date-fns/tz'
import { NAIROBI_TZ } from '../../lib/safeToSpend'

/**
 * Pure M-PESA statement parser (PRD F5). Turns the extracted text of an M-PESA
 * full statement's transaction table into candidate rows for review. No I/O, no
 * formatting — integer cents out, dates in Africa/Nairobi (CLAUDE.md). The
 * pattern lives here as a single anchored regex over each line; fixtures in
 * `__fixtures__/` pin the formats (parser rule: fixture first, then pattern).
 *
 * The statement table columns are: Receipt No. · Completion Time · Details ·
 * Transaction Status · Paid In · Withdrawn · Balance. Paid-in maps to income,
 * withdrawn to expense; the Receipt No. is the `mpesa_ref` dedupe key so a
 * re-import never doubles a row. Direction beyond in/out (e.g. a transfer
 * between the user's own accounts) can't be known from the statement alone, so
 * everything is income/expense here and the user recategorizes on review.
 */

export interface StatementCandidate {
  mpesaRef: string
  /** ISO instant (Nairobi wall-clock from the statement). */
  occurredAt: string
  kind: 'income' | 'expense'
  amountCents: number
  merchant: string | null
  note: string
}

// Receipt(10) · date · time · details(lazy) · status · paidIn · withdrawn · balance
const LINE_RE =
  /^([A-Z0-9]{10})\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s+(.+?)\s+(Completed|Failed|Pending|Reversed)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*$/

/** "1,500.00" → 150000 integer cents, using integer math only (never a float multiply). */
export function parseAmountToCents(value: string): number {
  const cleaned = value.replace(/,/g, '')
  const [whole = '0', frac = ''] = cleaned.split('.')
  const cents = Number(whole) * 100 + Number(`${frac}00`.slice(0, 2))
  return cents
}

function toIso(date: string, time: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm, ss] = time.split(':').map(Number)
  const zoned = new TZDate(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss), NAIROBI_TZ)
  // TZDate.toISOString() keeps the +03:00 offset; normalize to a UTC "Z" instant.
  return new Date(zoned.getTime()).toISOString()
}

/**
 * Best-effort merchant from the Details column — strips the common M-PESA
 * prefixes and trailing phone numbers so "Pay Bill to KPLC Prepaid Acc. 123"
 * reads as "KPLC Prepaid" on the review row. The full detail text is always kept
 * as the note, so nothing is lost.
 */
function extractMerchant(details: string): string | null {
  let text = details
    .replace(/^Customer Transfer(?: of Funds Charge| to)?\s*/i, '')
    .replace(/^Pay Bill(?: Online)?(?: to| Charge)?\s*/i, '')
    .replace(/^Merchant Payment(?: to| Charge)?\s*/i, '')
    .replace(/^Funds received from\s*/i, '')
    .replace(/^Buy Bundles.*$/i, 'Airtime & bundles')
    .replace(/^Airtime Purchase.*$/i, 'Airtime')
    .replace(/\b(?:254\d{9}|0[17]\d{8})\b\s*-?\s*/g, '') // strip phone numbers
    .replace(/\s+Acc\.?\s.*$/i, '') // drop "Acc. 12345" tails
    .replace(/\s{2,}/g, ' ')
    .trim()
  // Drop a leading "- " left behind by a stripped phone number.
  text = text.replace(/^[-–]\s*/, '').trim()
  return text.length > 0 ? text : null
}

export interface ParseStatementResult {
  candidates: StatementCandidate[]
  /** Completed lines whose amounts were both zero (nothing to import) — informational. */
  skippedZero: number
  /** Non-completed lines (failed/pending/reversed) that were not imported. */
  skippedStatus: number
}

/** Parse extracted statement text into reviewable candidates (Completed, non-zero rows only). */
export function parseStatement(text: string): ParseStatementResult {
  const candidates: StatementCandidate[] = []
  let skippedZero = 0
  let skippedStatus = 0

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    const match = LINE_RE.exec(line)
    if (!match) continue

    const [, ref, date, time, details, status, paidIn, withdrawn] = match
    if (status !== 'Completed') {
      skippedStatus += 1
      continue
    }

    const paidInCents = parseAmountToCents(paidIn ?? '0')
    const withdrawnCents = parseAmountToCents(withdrawn ?? '0')
    if (paidInCents === 0 && withdrawnCents === 0) {
      skippedZero += 1
      continue
    }

    const kind: 'income' | 'expense' = paidInCents > 0 ? 'income' : 'expense'
    const amountCents = paidInCents > 0 ? paidInCents : withdrawnCents
    const detailText = (details ?? '').trim()

    candidates.push({
      mpesaRef: ref ?? '',
      occurredAt: toIso(date ?? '', time ?? ''),
      kind,
      amountCents,
      merchant: extractMerchant(detailText),
      note: detailText,
    })
  }

  return { candidates, skippedZero, skippedStatus }
}
