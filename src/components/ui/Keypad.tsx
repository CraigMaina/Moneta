import { useCallback, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '../../lib/cn'
import { BackspaceIcon } from './icons'

export type KeypadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | 'backspace'

export interface KeypadState {
  /** Whole-KES digits typed so far. Never empty — "0" is the floor a backspace bottoms out at. */
  whole: string
  /** True once the user has typed the decimal point. */
  hasDecimal: boolean
  /** 0-2 digits typed after the decimal point. */
  decimal: string
}

// eslint-disable-next-line react-refresh/only-export-components -- pure keypad-math contract colocated with the component it feeds; exported for its exhaustive unit tests
export const INITIAL_KEYPAD_STATE: KeypadState = { whole: '0', hasDecimal: false, decimal: '' }

// Guards the whole-KES digit count so `keypadStateToCents` can never produce
// an unsafe integer once multiplied by 100 cents/unit. 12 digits is
// KES 999,999,999,999 — far beyond any personal-finance amount; this only
// stops a stuck-finger runaway input, it never bites a real user. Not a
// CLAUDE.md token. See DECISIONS.md.
const MAX_WHOLE_DIGITS = 12

/**
 * The pure cents-math contract for the keypad. This is money-critical logic —
 * it is the ONLY place a keystroke turns into part of an amount, and it must
 * never produce a float or a non-integer. Exhaustively unit-tested.
 *
 * Rules: a single decimal point; max two decimal places (a third digit after
 * the point is ignored); a leading "0" is replaced (not accumulated) by the
 * next whole-part digit typed; backspace removes the last thing typed (a
 * decimal digit, then the point itself, then whole digits) and floors at "0".
 */
// eslint-disable-next-line react-refresh/only-export-components -- pure keypad-math contract colocated with the component it feeds; exported for its exhaustive unit tests
export function applyKeypadKey(state: KeypadState, key: KeypadKey): KeypadState {
  if (key === 'backspace') {
    if (state.hasDecimal) {
      if (state.decimal.length > 0) {
        return { ...state, decimal: state.decimal.slice(0, -1) }
      }
      return { ...state, hasDecimal: false }
    }
    if (state.whole.length > 1) {
      return { ...state, whole: state.whole.slice(0, -1) }
    }
    return { ...state, whole: '0' }
  }

  if (key === '.') {
    return state.hasDecimal ? state : { ...state, hasDecimal: true }
  }

  // Digit 0-9.
  if (state.hasDecimal) {
    if (state.decimal.length >= 2) return state // third decimal digit ignored
    return { ...state, decimal: state.decimal + key }
  }

  if (state.whole === '0') {
    // Leading-zero sanity: "0" then "0" stays "0"; "0" then "5" becomes "5", not "05".
    return key === '0' ? state : { ...state, whole: key }
  }
  if (state.whole.length >= MAX_WHOLE_DIGITS) return state
  return { ...state, whole: state.whole + key }
}

/**
 * Converts a keypad buffer into integer cents. Parses each digit group with
 * `parseInt` (never `parseFloat`) so no float ever touches the money path.
 */
// eslint-disable-next-line react-refresh/only-export-components -- pure keypad-math contract colocated with the component it feeds; exported for its exhaustive unit tests
export function keypadStateToCents(state: KeypadState): number {
  const wholeUnits = Number.parseInt(state.whole, 10)
  const decimalDigits = state.decimal.padEnd(2, '0')
  const decimalCents = Number.parseInt(decimalDigits, 10)
  return wholeUnits * 100 + decimalCents
}

/** Seeds a keypad buffer from a committed cents value (e.g. editing an existing amount). Negative/non-finite input floors to 0 — the keypad only ever builds positive amounts. */
// eslint-disable-next-line react-refresh/only-export-components -- pure keypad-math contract colocated with the component it feeds; exported for its exhaustive unit tests
export function centsToKeypadState(cents: number): KeypadState {
  const safeCents = Number.isFinite(cents) && cents > 0 ? Math.trunc(cents) : 0
  const whole = Math.trunc(safeCents / 100)
  const decimalValue = safeCents % 100
  const hasDecimal = decimalValue > 0
  return {
    whole: String(whole),
    hasDecimal,
    decimal: hasDecimal ? String(decimalValue).padStart(2, '0') : '',
  }
}

/** Presentation-only grouping of the raw typing buffer (preserves a trailing "12." while the user is mid-keystroke, which `formatKES` would otherwise round away). Never used for money math — only for the live readout. */
// eslint-disable-next-line react-refresh/only-export-components -- pure keypad-math contract colocated with the component it feeds; exported for its exhaustive unit tests
export function formatKeypadBuffer(state: KeypadState): string {
  const groupedWhole = new Intl.NumberFormat('en-US', { useGrouping: true, maximumFractionDigits: 0 }).format(
    Number.parseInt(state.whole, 10),
  )
  if (!state.hasDecimal) return groupedWhole
  return `${groupedWhole}.${state.decimal}`
}

export interface KeypadProps {
  /**
   * Seeds the pad on mount (e.g. editing an existing amount). Read once —
   * the pad manages its own typing buffer thereafter. A fully round-tripped
   * controlled loop (state derived from `valueCents` on every keystroke)
   * would lose in-progress buffer state (a trailing decimal point rounds
   * away once converted to cents and back). See DECISIONS.md.
   */
  valueCents?: number
  /** Fires with the new integer-cents value after every keystroke. */
  onChange: (cents: number) => void
  className?: string
}

const KEY_ROWS: KeypadKey[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', 'backspace'],
]

const KEY_LABELS: Record<KeypadKey, string> = {
  '0': 'Digit 0',
  '1': 'Digit 1',
  '2': 'Digit 2',
  '3': 'Digit 3',
  '4': 'Digit 4',
  '5': 'Digit 5',
  '6': 'Digit 6',
  '7': 'Digit 7',
  '8': 'Digit 8',
  '9': 'Digit 9',
  '.': 'Decimal point',
  backspace: 'Delete last digit',
}

/**
 * The oversized numeric entry pad for the 3-second manual-entry flow (PRD
 * F4). Touch targets scale with the viewport (`aspect-square` circles inside
 * a 3-column grid) and stay well above the 44px floor on any phone-width
 * screen. Emits integer cents only — see `applyKeypadKey`/`keypadStateToCents`.
 */
export function Keypad({ valueCents = 0, onChange, className }: KeypadProps) {
  const prefersReducedMotion = useReducedMotion()
  const [state, setState] = useState<KeypadState>(() => centsToKeypadState(valueCents))

  const handleKey = useCallback(
    (key: KeypadKey) => {
      setState((current) => {
        const next = applyKeypadKey(current, key)
        onChange(keypadStateToCents(next))
        return next
      })
    },
    [onChange],
  )

  return (
    <div className={cn('w-full', className)}>
      {/* Pinned to the top of the scrolling sheet so the number you're typing
          stays visible while your thumb is on the pad below (no scroll-up). */}
      <div className="sticky top-0 z-10 mb-3 bg-paper-50 pb-2 pt-1 text-center">
        <p className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-600">Amount</p>
        <p className="mt-0.5 font-display text-[38px] leading-tight font-semibold tabular-nums text-ink-900">
          <span className="mr-1 align-top text-[18px] font-semibold text-ink-600">KES</span>
          {formatKeypadBuffer(state)}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {KEY_ROWS.flat().map((key) => (
          <KeypadKeyButton key={key} keyValue={key} onPress={() => handleKey(key)} reducedMotion={Boolean(prefersReducedMotion)} />
        ))}
      </div>
    </div>
  )
}

function KeypadKeyButton({
  keyValue,
  onPress,
  reducedMotion,
}: {
  keyValue: KeypadKey
  onPress: () => void
  reducedMotion: boolean
}) {
  const isBackspace = keyValue === 'backspace'
  return (
    <motion.button
      type="button"
      onClick={onPress}
      aria-label={KEY_LABELS[keyValue]}
      whileTap={reducedMotion ? undefined : { scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      className={cn(
        // Height-capped (not aspect-square) so the whole pad + the form below
        // fit a phone screen without scrolling; still well above the 44px floor.
        'flex h-14 w-full items-center justify-center rounded-2xl text-[24px] font-semibold tabular-nums text-ink-900',
        'bg-paper-0 shadow-sm active:bg-coral-100',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600 focus-visible:ring-offset-2 focus-visible:ring-offset-paper-0',
      )}
    >
      {isBackspace ? <BackspaceIcon className="h-6 w-6" /> : keyValue}
    </motion.button>
  )
}
