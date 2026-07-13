import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App } from './App'

/**
 * Smoke test: the shell renders the placeholder Home route. Uses a plain
 * QueryClientProvider (no IndexedDB persistence) to keep the test focused on
 * routing/rendering rather than persistence wiring.
 */
describe('App', () => {
  it('renders the Moneta wordmark on the home route', () => {
    const queryClient = new QueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(screen.getByRole('heading', { name: 'Moneta' })).toBeInTheDocument()
  })
})
