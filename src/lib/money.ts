/**
 * Money — the display edge of the money path.
 *
 * CLAUDE.md Money rules (non-negotiable):
 *  - All amounts are integer cents. There are NO floats and NO string math on
 *    money anywhere in the app. Arithmetic happens on integer cents; formatting
 *    to KES happens ONLY here, at the display edge.
 *  - Display format: `KES 1,450` — no decimals unless the cents part is
 *    non-zero, in which case exactly two decimals (`KES 1,450.50`).
 *  - Amounts in the domain are always positive (direction lives in `kind`), but
 *    derived numbers like safe-to-spend CAN be negative, so formatting handles a
 *    sign: `-KES 1,450`.
 *
 * Hero/tabular-numeral styling is a CSS concern (`font-variant-numeric:
 * tabular-nums`), not this module's — these functions only produce the string.
 */

const CENTS_PER_UNIT = 100

/** Coerce a cents value (number or bigint) to a safe integer number of cents. */
function toIntCents(cents: number | bigint): number {
  if (typeof cents === 'bigint') {
    // KES amounts fit comfortably in a JS safe integer; guard the extreme.
    if (cents > BigInt(Number.MAX_SAFE_INTEGER) || cents < BigInt(Number.MIN_SAFE_INTEGER)) {
      throw new RangeError(`money: cents value ${cents} exceeds safe integer range`)
    }
    return Number(cents)
  }
  if (!Number.isFinite(cents)) {
    throw new TypeError(`money: cents must be a finite number, got ${cents}`)
  }
  if (!Number.isInteger(cents)) {
    // A non-integer cents value means a float leaked into the money path —
    // fail loudly rather than silently rounding it away.
    throw new TypeError(`money: cents must be an integer, got ${cents}`)
  }
  return cents
}

export interface FormatOptions {
  /** Prefix the currency symbol ("KES "). Default true. */
  withSymbol?: boolean
}

/**
 * Format integer cents as grouped KES, e.g. 145000 -> "KES 1,450",
 * 145050 -> "KES 1,450.50", -145000 -> "-KES 1,450".
 */
export function formatKES(cents: number | bigint, options: FormatOptions = {}): string {
  const { withSymbol = true } = options
  const intCents = toIntCents(cents)

  const negative = intCents < 0
  const absCents = Math.abs(intCents)

  const units = Math.trunc(absCents / CENTS_PER_UNIT)
  const remainder = absCents % CENTS_PER_UNIT

  // Group the whole-unit part with thousands separators. Intl handles grouping
  // deterministically; we control decimals ourselves so the "no decimals unless
  // non-zero cents" rule is exact regardless of locale defaults.
  const groupedUnits = new Intl.NumberFormat('en-US', {
    useGrouping: true,
    maximumFractionDigits: 0,
  }).format(units)

  const decimals = remainder === 0 ? '' : `.${String(remainder).padStart(2, '0')}`

  const sign = negative ? '-' : ''
  const symbol = withSymbol ? 'KES ' : ''
  return `${sign}${symbol}${groupedUnits}${decimals}`
}

/**
 * Grouped amount without the currency symbol, e.g. 145000 -> "1,450".
 * Useful for the safe-to-spend hero, which styles the "KES" mark separately
 * from the oversized tabular numeral.
 */
export function formatAmount(cents: number | bigint): string {
  return formatKES(cents, { withSymbol: false })
}

/** Whole KES units (truncated toward zero) from integer cents. */
export function centsToUnits(cents: number | bigint): number {
  return Math.trunc(toIntCents(cents) / CENTS_PER_UNIT)
}

/** Convert whole KES units to integer cents. */
export function unitsToCents(units: number): number {
  if (!Number.isInteger(units)) {
    throw new TypeError(`money: units must be an integer, got ${units}`)
  }
  return units * CENTS_PER_UNIT
}
