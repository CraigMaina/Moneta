import type { ParseConfirmationEdits } from '../parser/ParseConfirmationCard'
import type { ParsedMpesaMessage } from '../../parser'
import type { AddTransactionInput } from './schemas'

const FEES_CATEGORY_NAME = 'Fees & Fuliza charges'

/**
 * Assemble the (1 or 2) transaction insert rows from the confirmation card's
 * edited values plus the parse provenance — the money-path counterpart of
 * `parsedToTransactions`, but driven by what the user actually confirmed
 * (they may have re-picked the amount, kind, category, or accounts).
 *
 * The row-splitting rule (CLAUDE.md money rule 3, `parser/types.ts`): a
 * `feeCents > 0` always becomes its OWN "Fees & Fuliza charges" expense row
 * with a distinct `${mpesaRef}-FEE` dedupe ref, debited from the fee account
 * (M-PESA) — never merged into the primary amount. `useSaveParsedTransactions`
 * validates each row through `addTransactionSchema` before it reaches the DB.
 */
export function buildParsedRows(
  parsed: ParsedMpesaMessage,
  edits: ParseConfirmationEdits,
  categoryIdByName: ReadonlyMap<string, string>,
): AddTransactionInput[] {
  if (!edits.accountId) {
    throw new Error('buildParsedRows: no account selected')
  }

  const base = {
    occurred_at: parsed.occurredAt,
    source: 'sms_parse' as const,
    parser_version: parsed.parserVersion,
    raw_sms: parsed.rawText,
  }
  const rows: AddTransactionInput[] = []
  const categoryId = edits.category ? (categoryIdByName.get(edits.category) ?? null) : null

  rows.push({
    ...base,
    kind: edits.kind,
    amount_cents: edits.amountCents,
    account_id: edits.accountId,
    counter_account_id: edits.kind === 'transfer' ? edits.counterAccountId : null,
    category_id: edits.kind === 'transfer' ? null : categoryId,
    merchant: edits.merchant,
    note: edits.note.trim() ? edits.note.trim() : null,
    mpesa_ref: parsed.mpesaRef,
    fee_cents: edits.feeCents > 0 ? edits.feeCents : null,
  })

  if (edits.feeCents > 0 && edits.feeAccountId) {
    rows.push({
      ...base,
      kind: 'expense',
      amount_cents: edits.feeCents,
      account_id: edits.feeAccountId,
      counter_account_id: null,
      category_id: categoryIdByName.get(FEES_CATEGORY_NAME) ?? null,
      merchant: parsed.merchant,
      note: 'Transaction fee',
      mpesa_ref: `${parsed.mpesaRef}-FEE`,
      fee_cents: null,
    })
  }

  return rows
}
