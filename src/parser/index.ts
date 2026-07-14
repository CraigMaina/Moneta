import { parsedMpesaMessageSchema } from './types'
import type { ParsedMpesaMessage, ParseResult } from './types'
import { compiledPatterns, PARSER_VERSION } from './patternTable'
import type { CompiledPattern } from './patternTable'
import { parseMoneyToCents } from './money'
import { parseMpesaTimestamp } from './timestamp'

export type { ParseResult, ParsedMpesaMessage } from './types'
export { parsedMpesaMessageSchema, CATEGORY_NAMES, MPESA_FAMILIES } from './types'
export type {
  CategoryName,
  MpesaFamily,
  TransactionKind,
  CounterAccountHint,
  TransferDirection,
} from './types'
export { parseMoneyToCents } from './money'
export { parseMpesaTimestamp, NAIROBI_TZ } from './timestamp'
export { normalizeMerchant, resolveMerchantCategory } from './merchant'
export type { MerchantRule } from './merchant'
export { PARSER_VERSION } from './patternTable'

/**
 * Parse a raw M-PESA SMS into a structured transaction.
 *
 * Deterministic, offline, pure: tries every `patterns.json` entry in order
 * (first match wins) and validates the assembled object through
 * `parsedMpesaMessageSchema` before returning it as `matched`. A pattern
 * that matches the text but fails schema validation, or throws while
 * extracting a field (bad money/date text), is treated exactly like a
 * non-match and the search continues — CLAUDE.md: "on validation failure,
 * ... never a guess." If nothing matches, the caller owns routing to the
 * LLM fallback / manual-entry prefill; this function never guesses.
 */
export function parseMpesaMessage(text: string): ParseResult {
  const trimmed = text.trim()
  if (!trimmed) {
    return { status: 'unmatched', raw: text }
  }

  for (const pattern of compiledPatterns) {
    const match = pattern.compiled.exec(trimmed)
    if (!match?.groups) continue

    const candidate = tryBuildParsedMessage(pattern, match.groups, trimmed)
    if (candidate) {
      return { status: 'matched', data: candidate }
    }
  }

  return { status: 'unmatched', raw: text }
}

function tryBuildParsedMessage(
  pattern: CompiledPattern,
  groups: Record<string, string | undefined>,
  rawText: string,
): ParsedMpesaMessage | null {
  try {
    const amountCents = parseMoneyToCents(requireGroup(groups, 'amount'))
    const mpesaRef = requireGroup(groups, 'ref').trim()
    const feeCents = groups.fee ? parseMoneyToCents(groups.fee) : 0
    const newBalanceCents = groups.balance ? parseMoneyToCents(groups.balance) : null
    const occurredAt = parseMpesaTimestamp(requireGroup(groups, 'date'), requireGroup(groups, 'time'))
    const merchant = groups.party ? cleanMerchantDisplay(groups.party) : null
    const accountReference = groups.account ? groups.account.trim() : null
    const reversalOfRef = groups.origRef ? groups.origRef.trim() : null

    const candidate = {
      amountCents,
      kind: pattern.kind,
      feeCents,
      merchant,
      accountReference,
      mpesaRef,
      occurredAt,
      newBalanceCents,
      category: pattern.category,
      family: pattern.family,
      counterAccountHint: pattern.counterAccountHint,
      transferDirection: pattern.transferDirection,
      reversalOfRef,
      rawText,
      patternId: pattern.id,
      parserVersion: PARSER_VERSION,
    }

    const result = parsedMpesaMessageSchema.safeParse(candidate)
    return result.success ? result.data : null
  } catch {
    // A candidate match whose money/date text doesn't actually parse is not
    // a match — never a guess, try the next pattern.
    return null
  }
}

function requireGroup(groups: Record<string, string | undefined>, name: string): string {
  const value = groups[name]
  if (!value) {
    throw new Error(`pattern group "${name}" missing or empty`)
  }
  return value
}

/** Display-only cleanup of a captured counterparty name: collapse whitespace, trim. Casing is left as Safaricom sent it. */
function cleanMerchantDisplay(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim()
}
