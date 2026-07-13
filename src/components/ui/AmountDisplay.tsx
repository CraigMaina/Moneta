import { cn } from '../../lib/cn'
import { formatKES } from '../../lib/money'

export type AmountDisplaySize = 'hero' | 'title' | 'body'
export type AmountDisplayTone = 'default' | 'income' | 'expense' | 'warning'

export interface AmountDisplayProps {
  /** Integer cents — this is the ONLY place a raw cents value should become a string, via `formatKES`. */
  cents: number
  size?: AmountDisplaySize
  tone?: AmountDisplayTone
  /** Prefixes a "+" for positive amounts (`formatKES` already prefixes "-" for negative). Useful for an income row ("+KES 500") sitting next to an expense row. Default false. */
  signed?: boolean
  /** Renders the numeral without the "KES" symbol. Default true. */
  withSymbol?: boolean
  className?: string
}

// Hero sits inside the CLAUDE.md 44-56px range; the middle of that band reads
// confident without crowding the safe-to-spend arc around it at 390px width.
// Not a distinct token — the range itself is the token. See DECISIONS.md.
const SIZE_CLASSES: Record<AmountDisplaySize, string> = {
  hero: 'font-display text-[52px] font-semibold leading-none',
  // Title-scale money uses the body face, not Bricolage — CLAUDE.md reserves
  // display type for "hero numbers, screen titles", and card/list amounts at
  // the 22px title scale read better in the body face (matches the existing
  // Card kitchen-sink demo). See DECISIONS.md.
  title: 'text-[22px] font-semibold leading-tight',
  body: 'text-[15px] font-semibold leading-normal',
}

// Expenses stay in ink-900 (calm, not alarming) — Moneta warns, it doesn't
// scold, and coral is reserved for primary actions/the hero arc, not "bad"
// money. `warning` (amber-600) is reserved for actual warning contexts (80%
// nudges, the over-budget hero state), not routine expenses. See DECISIONS.md.
const TONE_CLASSES: Record<AmountDisplayTone, string> = {
  default: 'text-ink-900',
  income: 'text-leaf-600',
  expense: 'text-ink-900',
  warning: 'text-amber-600',
}

/**
 * The canonical money renderer. Always renders through `formatKES` with
 * `tabular-nums` — no component in the app should format or do math on money
 * as a string/float outside this component and `src/lib/money.ts`.
 */
export function AmountDisplay({
  cents,
  size = 'body',
  tone = 'default',
  signed = false,
  withSymbol = true,
  className,
}: AmountDisplayProps) {
  const formatted = formatKES(cents, { withSymbol })
  const prefix = signed && cents > 0 ? '+' : ''

  return (
    <span className={cn('tabular-nums', SIZE_CLASSES[size], TONE_CLASSES[tone], className)}>
      {prefix}
      {formatted}
    </span>
  )
}
