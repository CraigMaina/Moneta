import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './Button'

describe('Button', () => {
  it('fires onClick when pressed', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Log it</Button>)

    await user.click(screen.getByRole('button', { name: 'Log it' }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not fire onClick when disabled', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <Button onClick={onClick} disabled>
        Log it
      </Button>,
    )

    const button = screen.getByRole('button', { name: 'Log it' })
    expect(button).toBeDisabled()
    await user.click(button)

    expect(onClick).not.toHaveBeenCalled()
  })

  it('does not fire onClick while loading, and keeps the label in the DOM', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    const { container } = render(
      <Button onClick={onClick} loading>
        Saving
      </Button>,
    )

    const button = screen.getByRole('button', { name: 'Saving' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    await user.click(button)
    expect(onClick).not.toHaveBeenCalled()

    // Spinner renders without collapsing the button's width-bearing label.
    expect(container.querySelector('svg')).toBeInTheDocument()
    expect(screen.getByText('Saving')).toBeInTheDocument()
  })

  it('renders full width when asked', () => {
    render(<Button fullWidth>Continue</Button>)
    expect(screen.getByRole('button', { name: 'Continue' })).toHaveClass('w-full')
  })
})
