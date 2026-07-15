import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MonthlyTrendChart } from './MonthlyTrendChart'

const data = [
  { monthKey: '2026-05', incomeCents: 1000_00, expenseCents: 400_00 },
  { monthKey: '2026-06', incomeCents: 0, expenseCents: 0 },
  { monthKey: '2026-07', incomeCents: 2000_00, expenseCents: 600_00 },
]

describe('MonthlyTrendChart', () => {
  it('renders a labelled, tappable bar per month', () => {
    render(<MonthlyTrendChart data={data} selectedMonthKey="2026-07" onSelectMonth={() => {}} />)
    expect(screen.getByText('May')).toBeInTheDocument()
    expect(screen.getByText('Jun')).toBeInTheDocument()
    expect(screen.getByText('Jul')).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(3)
  })

  it('selects a month when its bar is tapped', async () => {
    const user = userEvent.setup({ delay: null })
    const onSelectMonth = vi.fn()
    render(<MonthlyTrendChart data={data} selectedMonthKey="2026-07" onSelectMonth={onSelectMonth} />)
    await user.click(screen.getByRole('button', { name: /May: in/ }))
    expect(onSelectMonth).toHaveBeenCalledWith('2026-05')
  })

  it('marks the selected month via aria-pressed', () => {
    render(<MonthlyTrendChart data={data} selectedMonthKey="2026-07" onSelectMonth={() => {}} />)
    expect(screen.getByRole('button', { name: /Jul: in/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /May: in/ })).toHaveAttribute('aria-pressed', 'false')
  })
})
