/**
 * Money parsing for M-PESA SMS text — the parser-side counterpart to
 * `src/lib/money.ts`'s display formatting.
 *
 * CRITICAL money rule (CLAUDE.md): never floats, never `parseFloat(x) * 100`.
 * M-PESA amounts in SMS text always look like "Ksh1,450.50", "KES 1,450",
 * "KSH 1,234", or a bare "1,234" (once the currency prefix has already been
 * stripped by the surrounding regex group). We strip separators, split on
 * the decimal point as TEXT, and compute `whole * 100 + paddedFraction` with
 * integer arithmetic only — no float ever touches the value.
 */

const MONEY_TEXT_PATTERN = /^(?:ksh|kes)?\s*([\d,]+)(?:\.(\d{1,2}))?\s*$/i

/**
 * Parse an M-PESA money string (with or without a "Ksh"/"KES" prefix and
 * thousands separators) into integer cents. Throws on anything that isn't a
 * well-formed money string — callers (the pattern extractor) treat a throw
 * as "this candidate match doesn't actually parse," never as a guess.
 */
export function parseMoneyToCents(raw: string): number {
  const match = MONEY_TEXT_PATTERN.exec(raw.trim())
  if (!match) {
    throw new TypeError(`money: cannot parse amount from "${raw}"`)
  }

  const wholeDigits = match[1]?.replace(/,/g, '') ?? ''
  if (wholeDigits === '' || !/^\d+$/.test(wholeDigits)) {
    throw new TypeError(`money: cannot parse whole part from "${raw}"`)
  }

  const fractionDigits = (match[2] ?? '').padEnd(2, '0').slice(0, 2)
  const fractionCents = fractionDigits === '' ? 0 : Number.parseInt(fractionDigits, 10)

  const whole = Number.parseInt(wholeDigits, 10)
  if (!Number.isSafeInteger(whole)) {
    throw new RangeError(`money: amount "${raw}" exceeds safe integer range`)
  }

  return whole * 100 + fractionCents
}
