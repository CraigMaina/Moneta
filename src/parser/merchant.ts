/**
 * Merchant normalization + the pure half of "merchant memory" (CLAUDE.md:
 * "normalize merchant strings ... before lookup in merchant_rules").
 *
 * This module does NOT touch Supabase or `merchant_rules` directly — the
 * feature-hook layer owns reading/writing that table. It owns only:
 *  1. `normalizeMerchant` — canonical uppercase key derivation, and
 *  2. `resolveMerchantCategory` — pure matching against an in-memory list of
 *     rules the caller already fetched.
 */

/** A merchant→category override, as the caller would load it from `merchant_rules`. */
export interface MerchantRule {
  merchantNormalized: string
  categoryName: string
}

// A trailing phone number, e.g. "0722123456" or "254722123456".
const TRAILING_PHONE = /\s+(?:254|0)\d{8,9}$/
// A trailing standalone numeric code left over once a phone number is gone
// (till number, agent number, short account code), e.g. "NAIVAS 174379".
const TRAILING_NUMERIC_CODE = /\s+\d{4,}$/
// Leftover trailing punctuation/dashes once codes are stripped.
const TRAILING_PUNCTUATION = /[\s.-]+$/

/**
 * Canonical merchant-memory key: trim, uppercase, collapse internal
 * whitespace, and strip trailing till/agent/phone-number noise so
 * "Naivas Prestige  174379" and "NAIVAS PRESTIGE" normalize to the same key.
 */
export function normalizeMerchant(raw: string): string {
  let value = raw.replace(/\s+/g, ' ').trim().toUpperCase()
  value = value.replace(TRAILING_PHONE, '')
  value = value.replace(TRAILING_NUMERIC_CODE, '')
  value = value.replace(TRAILING_PUNCTUATION, '')
  return value.trim()
}

/**
 * Given an already-normalized merchant key and the user's loaded
 * `merchant_rules`, return the overriding category name, or `null` if no
 * rule matches. Pure — the caller is responsible for fetching `rules` and
 * for writing a new rule when the user corrects a category.
 */
export function resolveMerchantCategory(normalizedMerchant: string, rules: readonly MerchantRule[]): string | null {
  const match = rules.find((rule) => rule.merchantNormalized === normalizedMerchant)
  return match?.categoryName ?? null
}
