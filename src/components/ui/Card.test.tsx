import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Card } from './Card'

describe('Card', () => {
  it('renders a plain surface with no interactive semantics by default', () => {
    render(<Card>Balance: KES 12,000</Card>)
    const card = screen.getByText('Balance: KES 12,000')
    expect(card).not.toHaveAttribute('role')
    expect(card).not.toHaveAttribute('tabindex')
  })

  it('fires onClick when interactive and clicked', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <Card interactive onClick={onClick}>
        Rent goal
      </Card>,
    )

    await user.click(screen.getByRole('button', { name: 'Rent goal' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('fires onClick on Enter and Space when interactive (keyboard activation)', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <Card interactive onClick={onClick}>
        Rent goal
      </Card>,
    )

    const card = screen.getByRole('button', { name: 'Rent goal' })
    card.focus()
    await user.keyboard('{Enter}')
    await user.keyboard(' ')

    expect(onClick).toHaveBeenCalledTimes(2)
  })
})
