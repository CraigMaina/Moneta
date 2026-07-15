import { TZDate } from '@date-fns/tz'
import { NAIROBI_TZ } from '../../lib/safeToSpend'

/**
 * Pure M-PESA statement parser (PRD F5). Turns the extracted text of an M-PESA
 * full statement's transaction table into candidate rows for review. No I/O, no
 * formatting — integer cents out, dates in Africa/Nairobi (CLAUDE.md).
 *
 * Real statements (verified against a live 77-page export) have quirks this
 * parser handles:
 *   - The amount is a SINGLE signed column (negative = out, positive = in)
 *     followed by the running balance — two numbers, not separate Paid-In /
 *     Withdrawn columns. Older/simple exports with three columns
 *     (paid-in · withdrawn · balance) are still supported.
 *   - The Details cell WRAPS onto following lines; those continuation lines
 *     (and repeated page headers / disclaimers) are stitched back onto the row.
 *   - One transaction (e.g. a Fuliza-funded purchase) produces several rows
 *     sharing ONE receipt number. Since `mpesa_ref` is a unique dedupe key, the
 *     first occurrence keeps the plain receipt and later ones get a `-1`, `-2`
 *     suffix — deterministic, so re-importing the same statement still dedupes.
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

// Receipt(10) · date · time(secs optional) · details(lazy) · status(word) ·
// then the trailing money columns (two or three signed decimals).
const ROW_RE =
  /^([A-Z0-9]{10})\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}(?::\d{2})?)\s+(.+?)\s+([A-Za-z]+)\s+(-?[\d,]+\.\d{2}(?:\s+-?[\d,]+\.\d{2})*)\s*$/

// Repeated page furniture and header/summary lines that must never be stitched
// into a transaction's details.
const NOISE_RE =
  /^(Disclaimer:|Any personal information|for which it was provided|Statement Verification|prompts to enter|For self-help|conditions apply|Terms and|Page \d+ of \d+|Receipt No\.|M-PESA STATEMENT|M-PESA Full Statement|Customer Name:|Mobile Number:|Email Address:|Statement Period:|Request Date:|SUMMARY|DETAILED STATEMENT|TRANSACTION TYPE|SEND MONEY:|RECEIVED MONEY:|AGENT |LIPA NA M-PESA|OTHERS:|TOTAL:)/i

// A standalone verification code (8 alphanumerics incl. a digit) — skip it, but
// don't skip an all-letter name that happens to be 8 chars on a wrapped line.
const VERIFICATION_CODE_RE = /^(?=[A-Z0-9]*\d)[A-Z0-9]{8}$/

/** "1,500.00" / "-3,115.56" → integer cents (sign preserved), integer math only. */
export function parseAmountToCents(value: string): number {
  const trimmed = value.trim()
  const negative = trimmed.startsWith('-')
  const cleaned = trimmed.replace(/[,\s]/g, '').replace(/^-/, '')
  const [whole = '0', frac = ''] = cleaned.split('.')
  const cents = Number(whole) * 100 + Number(`${frac}00`.slice(0, 2))
  return negative ? -cents : cents
}

function toIso(date: string, time: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm, ss] = time.split(':').map(Number)
  const zoned = new TZDate(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss ?? 0), NAIROBI_TZ)
  // TZDate.toISOString() keeps the +03:00 offset; normalize to a UTC "Z" instant.
  return new Date(zoned.getTime()).toISOString()
}

/**
 * Best-effort merchant from the (merged) Details. M-PESA rows read like
 * "… to 515026 - Naivas West End Plaza" or "Merchant Payment to Naivas
 * Supermarket"; take the part after the last " - " when present, else strip the
 * common prefixes, then drop a leading phone/till and any "Acc. …" tail. The
 * full detail is always kept as the note, so nothing is lost.
 */
function extractMerchant(detail: string): string | null {
  let text = detail.trim()
  const dashIndex = text.lastIndexOf(' - ')
  if (dashIndex !== -1) {
    text = text.slice(dashIndex + 3)
  } else {
    text = text
      .replace(/^Customer Transfer(?: of Funds Charge| to)?\s*/i, '')
      .replace(/^Customer Payment to Small Business to\s*/i, '')
      .replace(/^Customer Send Money to Micro SME Business(?: with Fuliza MPesa)? to\s*/i, '')
      .replace(/^Pay Bill(?: Online)?(?: Fuliza M-Pesa)?(?: to| Charge)?\s*/i, '')
      .replace(/^Merchant Payment(?: Online| Fuliza M-Pesa)?(?: to| Charge)?\s*/i, '')
      .replace(/^Funds received from\s*/i, '')
      .replace(/^Airtime Purchase.*$/i, 'Airtime')
      .replace(/^Customer Bundle Purchase.*$/i, 'Airtime & bundles')
  }
  text = text
    .replace(/^[\d*]+\s+/, '') // leading (possibly masked) phone / till number
    .replace(/\s+Acc\.?\s.*$/i, '') // trailing "Acc. 12345"
    .replace(/\s{2,}/g, ' ')
    .trim()
  return text.length > 0 ? text : null
}

export interface ParseStatementResult {
  candidates: StatementCandidate[]
  /** Completed lines whose amount was zero (nothing to import) — informational. */
  skippedZero: number
  /** Non-completed lines (failed/pending/reversed) that were not imported. */
  skippedStatus: number
}

interface AmountDirection {
  kind: 'income' | 'expense'
  amountCents: number
}

/** Turn the trailing money tokens into a signed direction + positive cents (or null to skip). */
function readAmount(moneyTokens: string[]): AmountDirection | null {
  if (moneyTokens.length >= 3) {
    // Old format: paid-in · withdrawn · balance.
    const paidIn = Math.abs(parseAmountToCents(moneyTokens[0] ?? '0'))
    const withdrawn = Math.abs(parseAmountToCents(moneyTokens[1] ?? '0'))
    if (paidIn === 0 && withdrawn === 0) return null
    return paidIn > 0 ? { kind: 'income', amountCents: paidIn } : { kind: 'expense', amountCents: withdrawn }
  }
  // New format: signed amount · balance.
  const signed = parseAmountToCents(moneyTokens[0] ?? '0')
  if (signed === 0) return null
  return signed > 0 ? { kind: 'income', amountCents: signed } : { kind: 'expense', amountCents: Math.abs(signed) }
}

/** Parse extracted statement text into reviewable candidates (Completed, non-zero rows only). */
export function parseStatement(text: string): ParseStatementResult {
  const candidates: StatementCandidate[] = []
  let skippedZero = 0
  let skippedStatus = 0
  const seenRefCounts = new Map<string, number>()

  // The row currently being assembled (its details may span continuation lines).
  let current: { candidate: StatementCandidate; detailParts: string[] } | null = null

  const finalize = () => {
    if (!current) return
    const detail = current.detailParts.join(' ').replace(/\s+/g, ' ').trim()
    current.candidate.note = detail
    current.candidate.merchant = extractMerchant(detail)
    candidates.push(current.candidate)
    current = null
  }

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue

    const match = ROW_RE.exec(line)
    if (match) {
      finalize()
      const [, ref, date, time, details, status, moneyStr] = match
      if ((status ?? '').toLowerCase() !== 'completed') {
        skippedStatus += 1
        continue
      }
      const direction = readAmount((moneyStr ?? '').trim().split(/\s+/))
      if (!direction) {
        skippedZero += 1
        continue
      }
      const receipt = ref ?? ''
      const occurrence = seenRefCounts.get(receipt) ?? 0
      seenRefCounts.set(receipt, occurrence + 1)
      const mpesaRef = occurrence === 0 ? receipt : `${receipt}-${occurrence}`

      current = {
        candidate: {
          mpesaRef,
          occurredAt: toIso(date ?? '', time ?? ''),
          kind: direction.kind,
          amountCents: direction.amountCents,
          merchant: null,
          note: '',
        },
        detailParts: [details ?? ''],
      }
    } else if (current && !NOISE_RE.test(line) && !VERIFICATION_CODE_RE.test(line)) {
      // A wrapped continuation of the current row's Details.
      current.detailParts.push(line)
    }
  }
  finalize()

  return { candidates, skippedZero, skippedStatus }
}
