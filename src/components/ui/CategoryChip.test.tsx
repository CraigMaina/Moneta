import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CategoryChip } from './CategoryChip'
import { GroceriesIcon } from './icons'

describe('CategoryChip', () => {
  it('fires onSelect when pressed', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<CategoryChip icon={<GroceriesIcon />} label="Groceries" selected={false} onSelect={onSelect} />)

    await user.click(screen.getByRole('button', { name: 'Groceries' }))
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('reflects selected state via aria-pressed and the selected fill', () => {
    render(<CategoryChip icon={<GroceriesIcon />} label="Groceries" selected onSelect={() => {}} />)
    const chip = screen.getByRole('button', { name: 'Groceries' })
    expect(chip).toHaveAttribute('aria-pressed', 'true')
    expect(chip).toHaveClass('bg-coral-100', 'text-coral-600')
  })

  it('reflects unselected state', () => {
    render(<CategoryChip icon={<GroceriesIcon />} label="Groceries" selected={false} onSelect={() => {}} />)
    const chip = screen.getByRole('button', { name: 'Groceries' })
    expect(chip).toHaveAttribute('aria-pressed', 'false')
    expect(chip).toHaveClass('bg-paper-50', 'text-ink-600')
  })

  it('meets the 44px touch-target floor', () => {
    render(<CategoryChip icon={<GroceriesIcon />} label="Groceries" selected={false} onSelect={() => {}} />)
    expect(screen.getByRole('button', { name: 'Groceries' })).toHaveClass('h-11')
  })
})
