import type { ParsedMpesaMessage } from '../../parser'
import type { TransactionInsert } from './types'

/**
 * The money-path integration seam (lead-owned): turn ONE `ParsedMpesaMessage`
 * (the parser contract) into the correct 1-or-2 `TransactionInsert` rows, per
 * the row-splitting rules documented in `src/parser/types.ts`.
 *
 * The two rules that make this correct (CLAUDE.md money rules 2 & 3, PRD §4.2):
 *  - A withdrawal / Fuliza-drawdown-with-fee is a TRANSFER **plus a separate
 *    fee expense** — never one expense. The transfer moves `amountCents`
 *    between accounts; the fee is its own `expense` row for `feeCents`.
 *  - `fee_cents` on a row is provenance only. The `account_balances` view
 *    ignores it (see that migration); the SEPARATE fee expense row is what
 *    actually debits the account. So we set `fee_cents` on the parent row for
 *    display/reconciliation AND emit the fee expense row — no double count.
 *
 * Transfer leg direction is mapped to the `account_balances` view's semantics
 * (transfer = −amount on `account_id`, +amount on `counter_account_id`):
 * `account_id` is always the SOURCE (money leaves), `counter_account_id` the
 * DESTINATION (money enters).
 *
 * Reversals are NOT an insert — they negate an existing transaction keyed by
 * `reversalOfRef` — so they're returned as a distinct outcome for the mutation
 * layer to resolve (look up the original by `mpesa_ref` and reverse it); never
 * booked as a fresh income/expense ("the number never lies", PRD §4.5).
 */

export interface AccountIds {
  mpesa: string
  cash: string
  bank: string
}

export interface MapParsedContext {
  userId: string
  /** The user's three v1 account ids (M-PESA is always one leg of an M-PESA SMS). */
  accountIds: AccountIds
  /** Seeded category NAME → category id, from the user's `categories` table. */
  categoryIdByName: ReadonlyMap<string, string>
  /**
   * Category NAME override from merchant memory — the caller resolves this via
   * `resolveMerchantCategory` against `merchant_rules` before calling here. It
   * wins over the parser's suggested `category` for income/expense families.
   * `null`/omitted = no rule for this merchant.
   */
  merchantCategoryOverride?: string | null
}

export type ParsedMapResult =
  | { type: 'inserts'; rows: TransactionInsert[] }
  | { type: 'reversal'; reversalOfRef: string; parsed: ParsedMpesaMessage }

const FEES_CATEGORY_NAME = 'Fees & Fuliza charges'

export function parsedToTransactions(parsed: ParsedMpesaMessage, ctx: MapParsedContext): ParsedMapResult {
  // Reversal: the action is to negate the original txn, not to insert a row.
  if (parsed.family === 'reversal') {
    if (!parsed.reversalOfRef) {
      // The schema guarantees this is set for reversals; guard defensively.
      throw new Error('parsedToTransactions: reversal message missing reversalOfRef')
    }
    return { type: 'reversal', reversalOfRef: parsed.reversalOfRef, parsed }
  }

  const base = {
    user_id: ctx.userId,
    occurred_at: parsed.occurredAt,
    source: 'sms_parse' as const,
    parser_version: parsed.parserVersion,
    raw_sms: parsed.rawText,
    merchant: parsed.merchant,
  }

  const rows: TransactionInsert[] = []

  if (parsed.kind === 'transfer') {
    if (parsed.counterAccountHint === null || parsed.transferDirection === null) {
      // Guaranteed non-null for non-reversal transfers by the schema invariant.
      throw new Error('parsedToTransactions: transfer missing counterAccountHint/transferDirection')
    }
    const mpesaId = ctx.accountIds.mpesa
    const counterId = ctx.accountIds[parsed.counterAccountHint]
    const [fromId, toId] =
      parsed.transferDirection === 'mpesa_to_counter' ? [mpesaId, counterId] : [counterId, mpesaId]

    rows.push({
      ...base,
      kind: 'transfer',
      amount_cents: parsed.amountCents,
      account_id: fromId,
      counter_account_id: toId,
      category_id: null,
      mpesa_ref: parsed.mpesaRef,
      fee_cents: parsed.feeCents > 0 ? parsed.feeCents : null,
      note: null,
    })
  } else {
    // income or expense — a single-account M-PESA row.
    const categoryName = ctx.merchantCategoryOverride ?? parsed.category
    const categoryId = categoryName ? (ctx.categoryIdByName.get(categoryName) ?? null) : null
    const note = parsed.accountReference ? `Acc: ${parsed.accountReference}` : null

    rows.push({
      ...base,
      kind: parsed.kind,
      amount_cents: parsed.amountCents,
      account_id: ctx.accountIds.mpesa,
      counter_account_id: null,
      category_id: categoryId,
      mpesa_ref: parsed.mpesaRef,
      fee_cents: parsed.feeCents > 0 ? parsed.feeCents : null,
      note,
    })
  }

  // The generic fee rule: any `feeCents > 0` becomes its OWN expense row in
  // "Fees & Fuliza charges", debited from M-PESA, with a distinct dedupe ref so
  // re-parsing the same SMS reproduces the same two refs (both upserts no-op).
  if (parsed.feeCents > 0) {
    rows.push({
      ...base,
      kind: 'expense',
      amount_cents: parsed.feeCents,
      account_id: ctx.accountIds.mpesa,
      counter_account_id: null,
      category_id: ctx.categoryIdByName.get(FEES_CATEGORY_NAME) ?? null,
      mpesa_ref: `${parsed.mpesaRef}-FEE`,
      fee_cents: null,
      note: 'Transaction fee',
    })
  }

  return { type: 'inserts', rows }
}
