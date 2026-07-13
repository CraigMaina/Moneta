import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AmountDisplay } from './AmountDisplay'

describe('AmountDisplay', () => {
  it('renders through formatKES with the currency symbol by default', () => {
    render(<AmountDisplay cents={145000} />)
    expect(screen.getByText('KES 1,450')).toBeInTheDocument()
  })

  it('omits the symbol when asked', () => {
    render(<AmountDisplay cents={145000} withSymbol={false} />)
    expect(screen.getByText('1,450')).toBeInTheDocument()
  })

  it('shows decimals only when cents are non-zero, matching formatKES', () => {
    render(<AmountDisplay cents={145050} />)
    expect(screen.getByText('KES 1,450.50')).toBeInTheDocument()
  })

  it('is tabular-nums at every size', () => {
    const { rerender } = render(<AmountDisplay cents={100} size="hero" />)
    expect(screen.getByText('KES 1')).toHaveClass('tabular-nums')

    rerender(<AmountDisplay cents={100} size="title" />)
    expect(screen.getByText('KES 1')).toHaveClass('tabular-nums')

    rerender(<AmountDisplay cents={100} size="body" />)
    expect(screen.getByText('KES 1')).toHaveClass('tabular-nums')
  })

  it('renders income tone in leaf-600', () => {
    render(<AmountDisplay cents={50000} tone="income" />)
    expect(screen.getByText('KES 500')).toHaveClass('text-leaf-600')
  })

  it('renders expense tone in ink-900, not a shaming color', () => {
    render(<AmountDisplay cents={50000} tone="expense" />)
    expect(screen.getByText('KES 500')).toHaveClass('text-ink-900')
  })

  it('renders warning tone in amber-600', () => {
    render(<AmountDisplay cents={50000} tone="warning" />)
    expect(screen.getByText('KES 500')).toHaveClass('text-amber-600')
  })

  it('prefixes a "+" for positive amounts only when signed', () => {
    render(<AmountDisplay cents={50000} signed tone="income" />)
    expect(screen.getByText('+KES 500')).toBeInTheDocument()
  })

  it('does not double a "-" for negative amounts when signed', () => {
    render(<AmountDisplay cents={-50000} signed />)
    expect(screen.getByText('-KES 500')).toBeInTheDocument()
  })

  it('never receives a float — formatKES throws loudly if one leaks in', () => {
    expect(() => render(<AmountDisplay cents={1450.5} />)).toThrow(TypeError)
  })
})
