import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { TabBar } from './TabBar'

describe('TabBar', () => {
  it('marks the tab matching the current route as active (aria-current)', () => {
    render(
      <MemoryRouter initialEntries={['/transactions']}>
        <TabBar onAddPress={vi.fn()} />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Transactions' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current')
  })

  it('fires onAddPress when the center Add button is pressed', async () => {
    const user = userEvent.setup()
    const onAddPress = vi.fn()

    render(
      <MemoryRouter initialEntries={['/']}>
        <TabBar onAddPress={onAddPress} />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'Add transaction' }))
    expect(onAddPress).toHaveBeenCalledTimes(1)
  })

  it('honors activeOverride for gallery display without needing real navigation', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <TabBar onAddPress={vi.fn()} activeOverride="insights" position="static" />
      </MemoryRouter>,
    )

    const insightsLink = screen.getByRole('link', { name: 'Insights' })
    const homeLink = screen.getByRole('link', { name: 'Home' })
    expect(within(insightsLink).getByText('Insights')).toHaveClass('text-coral-600')
    expect(within(homeLink).getByText('Home')).not.toHaveClass('text-coral-600')
  })
})
