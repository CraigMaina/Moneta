import { z } from 'zod'
import rawPatternTable from './patterns.json'
import { categoryNameSchema, counterAccountHintSchema, mpesaFamilySchema, transferDirectionSchema } from './types'

/**
 * Loads + validates `patterns.json` (CLAUDE.md: "the pattern table is data
 * ... versioned"). Validation runs once at module load — a malformed data
 * file fails loudly at import time rather than producing silent bad
 * matches at runtime.
 *
 * Every pattern entry compiles to a `RegExp` with NAMED capture groups.
 * Group names the extractor (`index.ts`) understands:
 *   ref     - the M-PESA transaction code (required on every pattern)
 *   amount  - the primary money amount (required)
 *   party   - counterparty / business / agent display name (optional)
 *   account - PayBill account reference (paybill family only)
 *   date    - "D/M/YY" or "D/M/YYYY" (required)
 *   time    - "H:MM AM/PM" (required)
 *   fee     - transaction cost / access fee (optional; 0 when absent)
 *   balance - "New M-PESA balance is Ksh..." (optional; null when absent)
 *   origRef - the ORIGINAL transaction's ref (reversal family only)
 */

const patternEntrySchema = z.object({
  id: z.string().min(1),
  family: mpesaFamilySchema,
  kind: z.enum(['income', 'expense', 'transfer']),
  category: categoryNameSchema.nullable(),
  counterAccountHint: counterAccountHintSchema,
  transferDirection: transferDirectionSchema,
  flags: z.string().min(1),
  regex: z.string().min(1),
})

const patternTableSchema = z.object({
  version: z.string().min(1),
  patterns: z.array(patternEntrySchema).min(1),
})

export type PatternEntry = z.infer<typeof patternEntrySchema>

export interface CompiledPattern extends PatternEntry {
  compiled: RegExp
}

const parsedTable = patternTableSchema.parse(rawPatternTable)

/** `patterns.json`'s `version` string, stamped onto every parsed message's `parserVersion`. */
export const PARSER_VERSION = parsedTable.version

/** Ordered — first match wins. See DECISIONS.md for the family-ordering rationale. */
export const compiledPatterns: CompiledPattern[] = parsedTable.patterns.map((entry) => ({
  ...entry,
  compiled: new RegExp(entry.regex, entry.flags),
}))
