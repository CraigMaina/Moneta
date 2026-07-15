import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CategoryDonut } from './CategoryDonut'

const slices = [
  { id: 'food', label: 'Food & Groceries', amountCents: 750_00 },
  { id: 'transport', label: 'Transport', amountCents: 250_00 },
]

describe('CategoryDonut', () => {
  it('renders a legend row with label and percentage per slice', () => {
    render(<CategoryDonut slices={slices} />)
    expect(screen.getByText('Food & Groceries')).toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument()
    expect(screen.getByText('Transport')).toBeInTheDocument()
    expect(screen.getByText('25%')).toBeInTheDocument()
  })

  it('drills into a category when its legend row is tapped', async () => {
    const user = userEvent.setup({ delay: null })
    const onSelect = vi.fn()
    render(<CategoryDonut slices={slices} onSelect={onSelect} />)
    await user.click(screen.getByRole('button', { name: /Food & Groceries/ }))
    expect(onSelect).toHaveBeenCalledWith('food')
  })

  it('does not make a non-interactive slice (Other) a button', () => {
    const withOther = [...slices, { id: '__other__', label: 'Other', amountCents: 100_00 }]
    render(<CategoryDonut slices={withOther} onSelect={() => {}} nonInteractiveIds={new Set(['__other__'])} />)
    expect(screen.queryByRole('button', { name: /Other/ })).toBeNull()
    expect(screen.getByText('Other')).toBeInTheDocument()
  })

  it('renders nothing when the total is zero', () => {
    const { container } = render(<CategoryDonut slices={[{ id: 'x', label: 'X', amountCents: 0 }]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
