// supabase/functions/parse-sms/prompt.ts
//
// System prompt + Anthropic tool definitions for the parse-sms LLM
// fallback. Kept separate from schema.ts (the validation gate) so prompt
// wording can be revised without touching validation logic, and vice
// versa. Pure data — no Deno/network access — so it's safe to import from
// a test file too, though today only schema.ts's logic is unit-tested per
// the brief.

import { CATEGORY_NAMES, EXTRACT_TOOL_NAME, MPESA_FAMILIES, NOT_MPESA_TOOL_NAME } from './schema.ts'

// Cost/latency choice for bounded, structured extraction on fallback traffic
// only (the deterministic parser handles the bulk of messages offline) —
// see DECISIONS.md for the rationale.
export const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001'

export const SYSTEM_PROMPT = `You are the M-PESA SMS extraction fallback for Moneta, a Kenyan personal-finance app. A deterministic pattern-matching parser already tried and failed to match this message; extract the transaction fields as precisely as you can, or say the message isn't an M-PESA transaction notification.

Money rules you MUST follow exactly:
- amountCents and feeCents are ALWAYS integer cents (multiply the shilling amount by 100). Never fractional, never a float.
- amountCents is always POSITIVE. Direction lives ONLY in "kind" (income | expense | transfer) — never encode direction in the sign of an amount.
- An M-PESA agent WITHDRAWAL is a transfer (M-PESA -> Cash), never an expense. Its fee (if the message states one) goes in feeCents, separate from amountCents — do not add the fee into amountCents.
- Deposits, Fuliza drawdown/repayment, and M-Shwari/KCB M-PESA moves are also transfers, never income or expense.
- Every transfer family (except a reversal) must set kind to "transfer" and category to null.
- category must be exactly one of these names (case-sensitive), or null if you are not confident: ${CATEGORY_NAMES.join(', ')}.
- family must be exactly one of: ${MPESA_FAMILIES.join(', ')}.
- occurredAt must be an ISO-8601 timestamp with an explicit "+03:00" offset (Africa/Nairobi is UTC+3 year-round, no daylight saving) reflecting the date/time printed in the message, e.g. "2026-07-13T14:05:00+03:00".
- For a reversal message: set family to "reversal", kind to "transfer", counterAccountHint and transferDirection to null, and reversalOfRef to the ORIGINAL transaction's M-PESA code being reversed. Every other family must leave reversalOfRef null.
- Never guess. If you are not confident about a field, prefer null over a wrong value — merchant, accountReference, newBalanceCents, category, and reversalOfRef all accept null.

You MUST call exactly one tool, with no text outside the tool call:
- Call "${EXTRACT_TOOL_NAME}" if this is an M-PESA transaction notification (money received, sent to a person, PayBill, Buy Goods, Pochi la Biashara, agent withdrawal, agent deposit, airtime purchase, Fuliza drawdown/repayment, an M-Shwari/KCB M-PESA transfer, or a reversal).
- Call "${NOT_MPESA_TOOL_NAME}" if it is NOT an M-PESA transaction message (for example: an OTP code, a promotional message, a balance-inquiry response, or unrelated text).`

const nullableString = { type: ['string', 'null'] }
const nullableInteger = { type: ['integer', 'null'] }

/** Anthropic Messages API `tools` array. Forced via `tool_choice: { type: 'any' }` so the model always calls one of these two — never free-form prose. */
export const ANTHROPIC_TOOLS = [
  {
    name: EXTRACT_TOOL_NAME,
    description: 'Record the extracted fields for an M-PESA transaction SMS.',
    input_schema: {
      type: 'object',
      properties: {
        amountCents: {
          type: 'integer',
          minimum: 1,
          description: 'Integer cents, always positive.',
        },
        kind: { type: 'string', enum: ['income', 'expense', 'transfer'] },
        feeCents: {
          type: 'integer',
          minimum: 0,
          description: 'Integer cents; 0 if the message states no fee.',
        },
        merchant: {
          ...nullableString,
          description: 'Counterparty / business / agent name, or null.',
        },
        accountReference: { ...nullableString, description: 'PayBill account number, or null.' },
        mpesaRef: { type: 'string', minLength: 1, description: 'The M-PESA transaction code.' },
        occurredAt: {
          type: 'string',
          description: 'ISO-8601 instant with an explicit +03:00 offset.',
        },
        newBalanceCents: {
          ...nullableInteger,
          description: 'New M-PESA balance in cents, if the message states one, else null.',
        },
        category: { anyOf: [{ type: 'string', enum: [...CATEGORY_NAMES] }, { type: 'null' }] },
        family: { type: 'string', enum: [...MPESA_FAMILIES] },
        counterAccountHint: {
          anyOf: [{ type: 'string', enum: ['cash', 'mpesa', 'bank'] }, { type: 'null' }],
        },
        transferDirection: {
          anyOf: [
            { type: 'string', enum: ['mpesa_to_counter', 'counter_to_mpesa'] },
            { type: 'null' },
          ],
        },
        reversalOfRef: {
          ...nullableString,
          description: 'The original mpesa_ref being reversed; null unless family is "reversal".',
        },
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
    },
  },
  {
    name: NOT_MPESA_TOOL_NAME,
    description: 'Call this instead when the message is not an M-PESA transaction notification.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
] as const
