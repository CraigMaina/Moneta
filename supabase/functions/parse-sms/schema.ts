// supabase/functions/parse-sms/schema.ts
//
// ── MUST stay in sync with src/parser/types.ts ──────────────────────────
// This Edge Function runs on Deno, not Node/Vite, so it cannot import the
// app's src/ tree directly. The `ParsedMpesaMessage` contract — including
// its cross-field invariants — is therefore reproduced BY HAND below. If
// `src/parser/types.ts`'s `parsedMpesaMessageSchema` ever changes (new
// field, new invariant, new category/family name), this file must be
// updated to match, or the LLM fallback will silently drift from the
// deterministic parser's contract. See DECISIONS.md for this coupling.
//
// This module is intentionally pure (no Deno/network/DB access) so it can
// be imported and unit-tested directly by Vitest as well as by the Deno
// entrypoint (`index.ts`) — the bare `zod` import resolves via
// node_modules under Vitest and via this folder's `deno.json` import map
// under Deno, so no code here is runtime-specific.

import { z } from 'zod'

/** PRD §4.3 seeded default category names — mirrors src/parser/types.ts CATEGORY_NAMES. */
export const CATEGORY_NAMES = [
  // Income
  'Salary',
  'Business',
  'Gig/Freelance',
  'Gift/Received',
  'Other income',
  // Expense
  'Food & Groceries',
  'Eating Out',
  'Transport',
  'Rent & Utilities',
  'Airtime & Data',
  'Shopping',
  'Health',
  'Education',
  'Family & Black Tax',
  'Chama & Savings-out',
  'Entertainment',
  'Subscriptions',
  'Fees & Fuliza charges',
  'Giving/Tithe',
  'Other',
] as const

export const INCOME_CATEGORY_NAMES: ReadonlySet<string> = new Set([
  'Salary',
  'Business',
  'Gig/Freelance',
  'Gift/Received',
  'Other income',
])

export const categoryNameSchema = z.enum(CATEGORY_NAMES)
export type CategoryName = z.infer<typeof categoryNameSchema>

/** Every known M-PESA SMS format family — mirrors src/parser/types.ts MPESA_FAMILIES. */
export const MPESA_FAMILIES = [
  'received',
  'sent_to_person',
  'paybill',
  'buy_goods',
  'pochi_la_biashara',
  'withdrawal',
  'deposit',
  'airtime',
  'fuliza_drawdown',
  'fuliza_repayment',
  'mshwari_kcb_transfer',
  'reversal',
] as const

export const mpesaFamilySchema = z.enum(MPESA_FAMILIES)
export type MpesaFamily = z.infer<typeof mpesaFamilySchema>

export const transactionKindSchema = z.enum(['income', 'expense', 'transfer'])
export type TransactionKind = z.infer<typeof transactionKindSchema>

export const counterAccountHintSchema = z.enum(['cash', 'mpesa', 'bank']).nullable()
export type CounterAccountHint = z.infer<typeof counterAccountHintSchema>

export const transferDirectionSchema = z.enum(['mpesa_to_counter', 'counter_to_mpesa']).nullable()
export type TransferDirection = z.infer<typeof transferDirectionSchema>

const isoInstantSchema = z
  .string()
  .refine(
    (value) => !Number.isNaN(Date.parse(value)),
    'occurredAt must be a valid ISO date/time string',
  )

const trimmedNonEmpty = z.string().trim().min(1)

/**
 * The full ParsedMpesaMessage contract (src/parser/types.ts
 * `parsedMpesaMessageSchema`), reproduced field-for-field including its
 * `superRefine` cross-field invariants. This is the FINAL gate every LLM
 * extraction must pass before this function will ever return
 * `{ status: 'matched' }` — a tool call that satisfies the tool's JSON
 * Schema shape but violates one of these invariants (e.g. a transfer
 * carrying a category, a non-reversal carrying reversalOfRef) is still
 * rejected and logged as a miss, never returned as a guess.
 */
export const parsedMpesaMessageSchema = z
  .object({
    amountCents: z
      .number()
      .int('amountCents must be an integer')
      .positive('amountCents must be > 0'),
    kind: transactionKindSchema,
    feeCents: z.number().int('feeCents must be an integer').nonnegative('feeCents must be >= 0'),
    merchant: trimmedNonEmpty.nullable(),
    accountReference: trimmedNonEmpty.nullable(),
    mpesaRef: trimmedNonEmpty,
    occurredAt: isoInstantSchema,
    newBalanceCents: z.number().int().nonnegative().nullable(),
    category: categoryNameSchema.nullable(),
    family: mpesaFamilySchema,
    counterAccountHint: counterAccountHintSchema,
    transferDirection: transferDirectionSchema,
    reversalOfRef: trimmedNonEmpty.nullable(),
    rawText: trimmedNonEmpty,
    patternId: trimmedNonEmpty,
    parserVersion: trimmedNonEmpty,
  })
  .superRefine((val, ctx) => {
    if (val.kind === 'transfer') {
      // Reversal is the one transfer-kind family with no real second account
      // — exempt it from the hint/direction requirement every other
      // transfer family must satisfy (mirrors src/parser/types.ts exactly).
      if (val.family !== 'reversal') {
        if (val.counterAccountHint === null) {
          ctx.addIssue({
            code: 'custom',
            message: 'transfers require counterAccountHint',
            path: ['counterAccountHint'],
          })
        }
        if (val.transferDirection === null) {
          ctx.addIssue({
            code: 'custom',
            message: 'transfers require transferDirection',
            path: ['transferDirection'],
          })
        }
      }
      if (val.category !== null) {
        ctx.addIssue({
          code: 'custom',
          message: 'transfers must not have a category',
          path: ['category'],
        })
      }
    } else {
      if (val.counterAccountHint !== null) {
        ctx.addIssue({
          code: 'custom',
          message: 'only transfers may set counterAccountHint',
          path: ['counterAccountHint'],
        })
      }
      if (val.transferDirection !== null) {
        ctx.addIssue({
          code: 'custom',
          message: 'only transfers may set transferDirection',
          path: ['transferDirection'],
        })
      }
      if (val.category !== null) {
        const isIncomeCategory = INCOME_CATEGORY_NAMES.has(val.category)
        if ((val.kind === 'income') !== isIncomeCategory) {
          ctx.addIssue({
            code: 'custom',
            message: `category "${val.category}" does not match kind "${val.kind}"`,
            path: ['category'],
          })
        }
      }
    }

    if (val.family === 'reversal' && val.reversalOfRef === null) {
      ctx.addIssue({
        code: 'custom',
        message: 'reversal messages require reversalOfRef',
        path: ['reversalOfRef'],
      })
    }
    if (val.family !== 'reversal' && val.reversalOfRef !== null) {
      ctx.addIssue({
        code: 'custom',
        message: 'only reversal messages set reversalOfRef',
        path: ['reversalOfRef'],
      })
    }
  })

export type ParsedMpesaMessage = z.infer<typeof parsedMpesaMessageSchema>

/**
 * What we ask the model to extract via the `extract_mpesa_transaction` tool
 * — everything in ParsedMpesaMessage EXCEPT `rawText`/`patternId`/
 * `parserVersion`, which this function fills in itself and never trusts
 * from the model (the model echoing the input back verbatim isn't
 * guaranteed, and patternId/parserVersion are provenance this function
 * owns, not something to extract).
 */
export const llmExtractionSchema = z.object({
  amountCents: z.number().int().positive(),
  kind: transactionKindSchema,
  feeCents: z.number().int().nonnegative(),
  merchant: trimmedNonEmpty.nullable(),
  accountReference: trimmedNonEmpty.nullable(),
  mpesaRef: trimmedNonEmpty,
  occurredAt: isoInstantSchema,
  newBalanceCents: z.number().int().nonnegative().nullable(),
  category: categoryNameSchema.nullable(),
  family: mpesaFamilySchema,
  counterAccountHint: counterAccountHintSchema,
  transferDirection: transferDirectionSchema,
  reversalOfRef: trimmedNonEmpty.nullable(),
})

export type LlmExtraction = z.infer<typeof llmExtractionSchema>

/** This function's own parser-version tag, stamped on every matched result and every parse_misses row it writes. */
export const LLM_PARSER_VERSION = 'llm'
/** parsedMpesaMessageSchema.patternId has no real patterns.json entry for LLM output — this sentinel fills that slot. */
export const LLM_PATTERN_ID = 'llm-fallback'

export const EXTRACT_TOOL_NAME = 'extract_mpesa_transaction'
export const NOT_MPESA_TOOL_NAME = 'not_mpesa_message'

/** A tool_use content block from the Anthropic Messages API — the minimal shape this module needs. */
export type AnthropicToolUse = { name: string; input: unknown }

export type ParseSmsOutcome =
  { status: 'matched'; data: ParsedMpesaMessage } | { status: 'manual'; raw: string }

/**
 * Pure mapping/validation core: turns the model's tool call into either a
 * fully-validated `ParsedMpesaMessage` or a manual-entry fallback. NEVER
 * returns unvalidated model output (CLAUDE.md Parser rules: "on validation
 * failure, surface manual-entry prefill, never a guess"). No Deno, network,
 * or DB access — this is exactly what the unit tests exercise directly,
 * with the Anthropic call itself mocked out at the `toolUse` boundary.
 */
export function interpretToolUse(
  toolUse: AnthropicToolUse | null,
  rawSms: string,
): ParseSmsOutcome {
  if (toolUse === null || toolUse.name === NOT_MPESA_TOOL_NAME) {
    return { status: 'manual', raw: rawSms }
  }
  if (toolUse.name !== EXTRACT_TOOL_NAME) {
    // Unrecognized tool name — defensive; should never happen since only
    // these two tools are offered to the model.
    return { status: 'manual', raw: rawSms }
  }

  const extracted = llmExtractionSchema.safeParse(toolUse.input)
  if (!extracted.success) {
    return { status: 'manual', raw: rawSms }
  }

  const candidate = {
    ...extracted.data,
    rawText: rawSms,
    patternId: LLM_PATTERN_ID,
    parserVersion: LLM_PARSER_VERSION,
  }

  const validated = parsedMpesaMessageSchema.safeParse(candidate)
  if (!validated.success) {
    return { status: 'manual', raw: rawSms }
  }

  return { status: 'matched', data: validated.data }
}
