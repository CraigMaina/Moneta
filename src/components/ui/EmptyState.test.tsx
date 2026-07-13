import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EmptyState } from './EmptyState'
import { ReceiptIcon } from './icons'

describe('EmptyState', () => {
  it('names the action and fires it from the button', async () => {
    const user = userEvent.setup()
    const onAction = vi.fn()

    render(
      <EmptyState
        icon={<ReceiptIcon />}
        title="No transactions yet"
        description="Paste an M-PESA message or log one manually to see it here."
        actionLabel="Add a transaction"
        onAction={onAction}
      />,
    )

    expect(screen.getByRole('heading', { name: 'No transactions yet' })).toBeInTheDocument()
    expect(
      screen.getByText('Paste an M-PESA message or log one manually to see it here.'),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Add a transaction' }))
    expect(onAction).toHaveBeenCalledTimes(1)
  })
})
