// supabase/functions/parse-sms/prompt.ts
//
// System prompt + Gemini structured-output schema for the parse-sms LLM
// fallback. Kept separate from schema.ts (the validation gate) so prompt
// wording can be revised without touching validation logic, and vice versa.
// Pure data — no Deno/network access — so it's safe to import from a test
// file too.

import { CATEGORY_NAMES, MPESA_FAMILIES } from './schema.ts'

// Free-tier, fast, strong structured-JSON extraction on fallback traffic only
// (the deterministic parser handles the bulk of messages offline) — see
// DECISIONS.md for the provider rationale.
export const GEMINI_MODEL = 'gemini-2.0-flash'

export const SYSTEM_PROMPT = `You are the M-PESA SMS extraction fallback for Moneta, a Kenyan personal-finance app. A deterministic pattern-matching parser already tried and failed to match this message; extract the transaction fields as precisely as you can, or say the message isn't an M-PESA transaction notification.

Return ONLY JSON matching the provided schema — an object with "parseable" and "transaction":
- If this IS an M-PESA transaction notification (money received, sent to a person, PayBill, Buy Goods, Pochi la Biashara, agent withdrawal, agent deposit, airtime purchase, Fuliza drawdown/repayment, an M-Shwari/KCB M-PESA transfer, or a reversal): set "parseable" to true and fill "transaction".
- If it is NOT an M-PESA transaction message (an OTP code, a promotion, a balance-inquiry response, or unrelated text): set "parseable" to false and "transaction" to null.

Money rules you MUST follow exactly when filling "transaction":
- amountCents and feeCents are ALWAYS integer cents (multiply the shilling amount by 100). Never fractional, never a float.
- amountCents is always POSITIVE. Direction lives ONLY in "kind" (income | expense | transfer) — never encode direction in the sign of an amount.
- An M-PESA agent WITHDRAWAL is a transfer (M-PESA -> Cash), never an expense. Its fee (if the message states one) goes in feeCents, separate from amountCents — do not add the fee into amountCents.
- Deposits, Fuliza drawdown/repayment, and M-Shwari/KCB M-PESA moves are also transfers, never income or expense.
- Every transfer family (except a reversal) must set kind to "transfer", category to null, and both counterAccountHint and transferDirection to non-null values.
- category must be exactly one of these names (case-sensitive), or null if you are not confident: ${CATEGORY_NAMES.join(', ')}.
- family must be exactly one of: ${MPESA_FAMILIES.join(', ')}.
- occurredAt must be an ISO-8601 timestamp with an explicit "+03:00" offset (Africa/Nairobi is UTC+3 year-round, no daylight saving) reflecting the date/time printed in the message, e.g. "2026-07-13T14:05:00+03:00".
- For a reversal message: set family to "reversal", kind to "transfer", counterAccountHint and transferDirection to null, and reversalOfRef to the ORIGINAL transaction's M-PESA code being reversed. Every other family must leave reversalOfRef null.
- Never guess. If you are not confident about a field, prefer null over a wrong value — merchant, accountReference, newBalanceCents, category, and reversalOfRef all accept null.`

// Gemini's responseSchema uses an OpenAPI subset: UPPERCASE `type`, `nullable`,
// `enum`, `properties`, `required`, `propertyOrdering`. It's a GUIDE for the
// model — the authoritative gate is schema.ts's zod validation, which rejects
// (→ manual) anything that slips through malformed.
const transactionSchema = {
  type: 'OBJECT',
  nullable: true,
  properties: {
    amountCents: { type: 'INTEGER', description: 'Integer cents, always positive.' },
    kind: { type: 'STRING', enum: ['income', 'expense', 'transfer'] },
    feeCents: { type: 'INTEGER', description: 'Integer cents; 0 if the message states no fee.' },
    merchant: { type: 'STRING', nullable: true, description: 'Counterparty / business / agent name, or null.' },
    accountReference: { type: 'STRING', nullable: true, description: 'PayBill account number, or null.' },
    mpesaRef: { type: 'STRING', description: 'The M-PESA transaction code.' },
    occurredAt: { type: 'STRING', description: 'ISO-8601 instant with an explicit +03:00 offset.' },
    newBalanceCents: { type: 'INTEGER', nullable: true, description: 'New M-PESA balance in cents, if stated, else null.' },
    category: { type: 'STRING', nullable: true, enum: [...CATEGORY_NAMES] },
    family: { type: 'STRING', enum: [...MPESA_FAMILIES] },
    counterAccountHint: { type: 'STRING', nullable: true, enum: ['cash', 'mpesa', 'bank'] },
    transferDirection: { type: 'STRING', nullable: true, enum: ['mpesa_to_counter', 'counter_to_mpesa'] },
    reversalOfRef: { type: 'STRING', nullable: true, description: 'The original mpesa_ref being reversed; null unless family is "reversal".' },
  },
  required: [
    'amountCents',
    'kind',
    'feeCents',
    'merchant',
    'accountReference',
    'mpesaRef',
    'occurredAt',
    'newBalanceCents',
    'category',
    'family',
    'counterAccountHint',
    'transferDirection',
    'reversalOfRef',
  ],
  propertyOrdering: [
    'amountCents',
    'kind',
    'feeCents',
    'merchant',
    'accountReference',
    'mpesaRef',
    'occurredAt',
    'newBalanceCents',
    'category',
    'family',
    'counterAccountHint',
    'transferDirection',
    'reversalOfRef',
  ],
} as const

/** `generationConfig.responseSchema` for Gemini structured output — the envelope schema.ts's `modelResponseSchema` validates. */
export const GEMINI_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    parseable: { type: 'BOOLEAN', description: 'True only if this is an M-PESA transaction notification.' },
    transaction: transactionSchema,
  },
  required: ['parseable', 'transaction'],
  propertyOrdering: ['parseable', 'transaction'],
} as const
