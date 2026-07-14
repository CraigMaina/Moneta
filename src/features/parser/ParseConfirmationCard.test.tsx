import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { airtimeFixtures, paybillFixtures, reversalFixtures, withdrawalFixtures } from '../../parser/__fixtures__'
import type { Fixture } from '../../parser/__fixtures__'
import type { ParsedMpesaMessage } from '../../parser/types'
import { ParseConfirmationCard, type AccountOption } from './ParseConfirmationCard'

/** Narrows `Fixture['expected']` (`ParsedMpesaMessage | 'unmatched'`) for TypeScript — every fixture used in this file is a matched one. */
function matched(fixture: Fixture): ParsedMpesaMessage {
  if (fixture.expected === 'unmatched') throw new Error(`fixture "${fixture.description}" is unexpectedly unmatched`)
  return fixture.expected
}

function mockMatchMedia(matches = false) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

const MPESA: AccountOption = { id: 'mpesa-1', name: 'M-PESA', type: 'mpesa' }
const CASH: AccountOption = { id: 'cash-1', name: 'Cash', type: 'cash' }
const ACCOUNTS = [MPESA, CASH]

describe('ParseConfirmationCard', () => {
  beforeEach(() => {
    mockMatchMedia(false)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('a parsed expense renders the correct amount, category, and "Log it" builds the right edits payload', async () => {
    const parsed = matched(airtimeFixtures[0]!) // expense, category 'Airtime & Data', no fee
    const onConfirm = vi.fn()
    const user = userEvent.setup()

    render(
      <ParseConfirmationCard
        parsed={parsed}
        accounts={ACCOUNTS}
        onConfirm={onConfirm}
        onEditCategory={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(screen.getByText('KES 100')).toBeInTheDocument()
    expect(screen.getByText('Airtime & Data')).toBeInTheDocument()
    // A plain expense shows no transfer headline and no fee line.
    expect(screen.queryByText('Fee')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Log it' }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
    const [edits] = onConfirm.mock.calls.at(0)!
    expect(edits).toMatchObject({
      amountCents: 10000,
      kind: 'expense',
      category: 'Airtime & Data',
      accountId: MPESA.id,
      counterAccountId: null,
      feeCents: 0,
      feeAccountId: null,
    })
  })

  it('a null category shows the "Pick a category" prompt, and tapping it calls onEditCategory', async () => {
    const parsed = matched(paybillFixtures[0]!) // category: null
    expect(parsed.category).toBeNull()
    const onEditCategory = vi.fn()
    const user = userEvent.setup()

    render(
      <ParseConfirmationCard parsed={parsed} accounts={ACCOUNTS} onConfirm={vi.fn()} onEditCategory={onEditCategory} onCancel={vi.fn()} />,
    )

    const prompt = screen.getByRole('button', { name: 'Pick a category' })
    expect(prompt).toBeInTheDocument()
    await user.click(prompt)
    expect(onEditCategory).toHaveBeenCalledTimes(1)
  })

  it('a withdrawal renders as a transfer + a separate fee line — never a single expense', async () => {
    const parsed = matched(withdrawalFixtures[0]!) // transfer, mpesa->cash, feeCents 2800
    const onConfirm = vi.fn()
    const user = userEvent.setup()

    render(<ParseConfirmationCard parsed={parsed} accounts={ACCOUNTS} onConfirm={onConfirm} onEditCategory={vi.fn()} onCancel={vi.fn()} />)

    // The transfer headline ("M-PESA -> Cash"), not a merchant/"Paid to" expense line.
    const headline = within(screen.getByTestId('transfer-headline'))
    expect(headline.getByText('M-PESA')).toBeInTheDocument()
    expect(headline.getByText('Cash')).toBeInTheDocument()
    expect(screen.queryByLabelText('Paid to')).not.toBeInTheDocument()
    // Transfers never carry a category (schema invariant) — no category UI at all.
    expect(screen.queryByText('Category')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pick a category' })).not.toBeInTheDocument()

    // The fee is its own visible line, distinct from the transfer amount.
    expect(screen.getByText('Fee')).toBeInTheDocument()
    expect(screen.getByText('KES 28')).toBeInTheDocument() // the fee amount
    expect(screen.getByText('KES 2,000')).toBeInTheDocument() // the transfer amount, unmodified by the fee

    await user.click(screen.getByRole('button', { name: 'Log it' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    const [edits] = onConfirm.mock.calls.at(0)!
    expect(edits).toMatchObject({
      kind: 'transfer',
      category: null,
      accountId: MPESA.id,
      counterAccountId: CASH.id,
      feeCents: 2800,
      feeAccountId: MPESA.id,
    })
  })

  it('reversal shows a calm explanation, not account/category editing', () => {
    const parsed = matched(reversalFixtures[0]!)
    render(
      <ParseConfirmationCard parsed={parsed} accounts={ACCOUNTS} onConfirm={vi.fn()} onEditCategory={vi.fn()} onCancel={vi.fn()} />,
    )

    expect(screen.getByText('Reverses a transaction')).toBeInTheDocument()
    expect(screen.getByText(parsed.reversalOfRef!)).toBeInTheDocument()
    expect(screen.queryByText('Category')).not.toBeInTheDocument()
    expect(screen.queryByText('Account')).not.toBeInTheDocument()
    expect(screen.queryByText('From')).not.toBeInTheDocument()
  })

  it('offers a one-tap "Sync balance" affordance only when newBalanceCents is present and onSyncBalance is wired', () => {
    const withBalance = matched(withdrawalFixtures[0]!)
    expect(withBalance.newBalanceCents).not.toBeNull()
    const onSyncBalance = vi.fn()

    const { rerender } = render(
      <ParseConfirmationCard
        parsed={withBalance}
        accounts={ACCOUNTS}
        onConfirm={vi.fn()}
        onEditCategory={vi.fn()}
        onCancel={vi.fn()}
        onSyncBalance={onSyncBalance}
      />,
    )
    expect(screen.getByRole('button', { name: 'Sync balance' })).toBeInTheDocument()

    // No onSyncBalance wired -> no affordance, even though the message has a balance.
    rerender(
      <ParseConfirmationCard parsed={withBalance} accounts={ACCOUNTS} onConfirm={vi.fn()} onEditCategory={vi.fn()} onCancel={vi.fn()} />,
    )
    expect(screen.queryByRole('button', { name: 'Sync balance' })).not.toBeInTheDocument()
  })

  it('calls onCancel from the Cancel action', async () => {
    const parsed = matched(airtimeFixtures[0]!)
    const onCancel = vi.fn()
    const user = userEvent.setup()
    render(<ParseConfirmationCard parsed={parsed} accounts={ACCOUNTS} onConfirm={vi.fn()} onEditCategory={vi.fn()} onCancel={onCancel} />)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('disables and shows a loading "Log it" while saving', () => {
    const parsed = matched(airtimeFixtures[0]!)
    render(
      <ParseConfirmationCard parsed={parsed} accounts={ACCOUNTS} onConfirm={vi.fn()} onEditCategory={vi.fn()} onCancel={vi.fn()} saving />,
    )
    expect(screen.getByRole('button', { name: 'Log it' })).toBeDisabled()
  })
})
