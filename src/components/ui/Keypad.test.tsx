import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  applyKeypadKey,
  centsToKeypadState,
  formatKeypadBuffer,
  INITIAL_KEYPAD_STATE,
  Keypad,
  keypadStateToCents,
  type KeypadKey,
  type KeypadState,
} from './Keypad'

function press(state: KeypadState, keys: KeypadKey[]): KeypadState {
  return keys.reduce((current, key) => applyKeypadKey(current, key), state)
}

describe('applyKeypadKey + keypadStateToCents (money-critical pure contract)', () => {
  it('types a whole-and-decimal amount to the exact cents value: 1,2,.,5,0 -> 1250', () => {
    const state = press(INITIAL_KEYPAD_STATE, ['1', '2', '.', '5', '0'])
    expect(keypadStateToCents(state)).toBe(1250)
  })

  it('typing "." first on an empty pad behaves as "0." (a bare decimal is still a valid, zero-floored amount)', () => {
    const afterDot = applyKeypadKey(INITIAL_KEYPAD_STATE, '.')
    expect(afterDot).toEqual({ whole: '0', hasDecimal: true, decimal: '' })
    expect(keypadStateToCents(afterDot)).toBe(0)

    const afterDigit = applyKeypadKey(afterDot, '5')
    expect(keypadStateToCents(afterDigit)).toBe(50) // KES 0.50
  })

  it('ignores a third decimal digit', () => {
    const twoDecimals = press(INITIAL_KEYPAD_STATE, ['1', '.', '2', '5'])
    expect(twoDecimals.decimal).toBe('25')
    const thirdIgnored = applyKeypadKey(twoDecimals, '9')
    expect(thirdIgnored).toEqual(twoDecimals) // unchanged
    expect(keypadStateToCents(thirdIgnored)).toBe(125)
  })

  it('ignores a second decimal point', () => {
    const oneDot = applyKeypadKey(INITIAL_KEYPAD_STATE, '.')
    const twoDots = applyKeypadKey(oneDot, '.')
    expect(twoDots).toEqual(oneDot)
  })

  it('leading-zero sanity: "0","0","5" collapses to "5", not "005" or "05"', () => {
    const state = press(INITIAL_KEYPAD_STATE, ['0', '0', '5'])
    expect(state.whole).toBe('5')
    expect(keypadStateToCents(state)).toBe(500)
  })

  it('backspace removes the last decimal digit first', () => {
    const typed = press(INITIAL_KEYPAD_STATE, ['1', '2', '.', '5'])
    const backspaced = applyKeypadKey(typed, 'backspace')
    expect(backspaced).toEqual({ whole: '12', hasDecimal: true, decimal: '' })
  })

  it('backspace then removes the decimal point itself, leaving the whole part intact', () => {
    const typed = press(INITIAL_KEYPAD_STATE, ['1', '2', '.'])
    const backspaced = applyKeypadKey(typed, 'backspace')
    expect(backspaced).toEqual({ whole: '12', hasDecimal: false, decimal: '' })
  })

  it('backspace then removes whole-part digits one at a time', () => {
    const typed = press(INITIAL_KEYPAD_STATE, ['1', '2', '3'])
    const once = applyKeypadKey(typed, 'backspace')
    expect(once.whole).toBe('12')
    const twice = applyKeypadKey(once, 'backspace')
    expect(twice.whole).toBe('1')
  })

  it('backspace to empty floors at "0", not an empty string', () => {
    const typed = applyKeypadKey(INITIAL_KEYPAD_STATE, '5')
    const backspaced = applyKeypadKey(typed, 'backspace')
    expect(backspaced).toEqual(INITIAL_KEYPAD_STATE)
    expect(keypadStateToCents(backspaced)).toBe(0)
  })

  it('backspacing past zero is a no-op (never negative, never empty)', () => {
    const backspaced = applyKeypadKey(INITIAL_KEYPAD_STATE, 'backspace')
    expect(backspaced).toEqual(INITIAL_KEYPAD_STATE)
  })

  it('caps whole-part length so cents can never exceed a safe integer', () => {
    const almostFull = { whole: '1'.repeat(12), hasDecimal: false, decimal: '' }
    const stillFull = applyKeypadKey(almostFull, '9')
    expect(stillFull).toEqual(almostFull)
    expect(Number.isSafeInteger(keypadStateToCents(stillFull))).toBe(true)
  })

  it('never produces a non-integer cents value across a long random-ish key sequence', () => {
    const sequence: KeypadKey[] = ['4', '5', '0', '.', '2', '5', 'backspace', '9', '.', '.', '1']
    const state = press(INITIAL_KEYPAD_STATE, sequence)
    const cents = keypadStateToCents(state)
    expect(Number.isInteger(cents)).toBe(true)
  })
})

describe('centsToKeypadState (seed helper)', () => {
  it('round-trips a whole amount', () => {
    expect(centsToKeypadState(145000)).toEqual({ whole: '1450', hasDecimal: false, decimal: '' })
  })

  it('round-trips an amount with cents', () => {
    expect(centsToKeypadState(1250)).toEqual({ whole: '12', hasDecimal: true, decimal: '50' })
  })

  it('floors negative or non-finite input to zero', () => {
    expect(centsToKeypadState(-500)).toEqual(INITIAL_KEYPAD_STATE)
    expect(centsToKeypadState(Number.NaN)).toEqual(INITIAL_KEYPAD_STATE)
  })
})

describe('formatKeypadBuffer (display-only, preserves in-progress typing)', () => {
  it('shows a trailing decimal point while the user is mid-keystroke', () => {
    const state = press(INITIAL_KEYPAD_STATE, ['1', '2', '.'])
    expect(formatKeypadBuffer(state)).toBe('12.')
  })

  it('groups thousands', () => {
    const state = press(INITIAL_KEYPAD_STATE, ['1', '4', '5', '0'])
    expect(formatKeypadBuffer(state)).toBe('1,450')
  })
})

describe('Keypad (component)', () => {
  it('emits the correct running cents value as the user types', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Keypad onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Digit 1' }))
    await user.click(screen.getByRole('button', { name: 'Digit 2' }))
    await user.click(screen.getByRole('button', { name: 'Decimal point' }))
    await user.click(screen.getByRole('button', { name: 'Digit 5' }))
    await user.click(screen.getByRole('button', { name: 'Digit 0' }))

    expect(onChange).toHaveBeenLastCalledWith(1250)
    expect(screen.getByText('12.50')).toBeInTheDocument()
  })

  it('backspace deletes the last keystroke and emits the updated cents', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Keypad onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Digit 5' }))
    await user.click(screen.getByRole('button', { name: 'Delete last digit' }))

    expect(onChange).toHaveBeenLastCalledWith(0)
  })

  it('renders every key with a visible, keyboard-focusable accessible name', () => {
    render(<Keypad onChange={() => {}} />)
    for (let d = 0; d <= 9; d += 1) {
      expect(screen.getByRole('button', { name: `Digit ${d}` })).toBeInTheDocument()
    }
    expect(screen.getByRole('button', { name: 'Decimal point' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete last digit' })).toBeInTheDocument()
  })
})
