import type { ParsedMpesaMessage } from '../types'

/**
 * Fixture-first corpus (CLAUDE.md: "every format family has realistic
 * sample messages ... before its pattern exists"). Each fixture pairs a raw
 * SMS string with its fully-expected parse result — either every field of
 * `ParsedMpesaMessage`, or an explicit `'unmatched'` for messages the
 * deterministic pattern table must NOT guess at (LLM-fallback candidates).
 */

export interface MatchedFixture {
  description: string
  raw: string
  expected: ParsedMpesaMessage
}

export interface UnmatchedFixture {
  description: string
  raw: string
  expected: 'unmatched'
}

export type Fixture = MatchedFixture | UnmatchedFixture

/** `patterns.json`'s current `version` — kept in one place so fixtures stay in sync with a version bump. */
export const PARSER_VERSION = 'pattern-2026.07'
