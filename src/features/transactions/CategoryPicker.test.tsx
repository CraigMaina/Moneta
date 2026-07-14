import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CategoryPicker } from './CategoryPicker'

const makeCategories = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `c${i}`, name: `Cat ${i}`, icon: null }))

describe('CategoryPicker', () => {
  it('shows every category (no expander) when there are few', () => {
    render(<CategoryPicker categories={makeCategories(4)} selectedId={null} onSelect={() => {}} />)
    expect(screen.getAllByRole('button')).toHaveLength(4)
    expect(screen.queryByRole('button', { expanded: false })).toBeNull()
  })

  it('collapses to a handful with a "+N more" expander when there are many', () => {
    render(<CategoryPicker categories={makeCategories(10)} selectedId={null} onSelect={() => {}} />)
    // 6 chips + the expander
    expect(screen.getByRole('button', { name: '+4 more' })).toBeInTheDocument()
    expect(screen.getByText('Cat 0')).toBeInTheDocument()
    expect(screen.queryByText('Cat 9')).toBeNull()
  })

  it('expands to reveal all categories, then collapses again', async () => {
    const user = userEvent.setup({ delay: null })
    render(<CategoryPicker categories={makeCategories(10)} selectedId={null} onSelect={() => {}} />)

    await user.click(screen.getByRole('button', { name: '+4 more' }))
    expect(screen.getByText('Cat 9')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Less' }))
    expect(screen.queryByText('Cat 9')).toBeNull()
  })

  it('keeps the selected category visible in the collapsed view', () => {
    // c9 would normally be hidden past the collapsed window; selecting it pulls it forward.
    render(<CategoryPicker categories={makeCategories(10)} selectedId="c9" onSelect={() => {}} />)
    const selected = screen.getByRole('button', { name: 'Cat 9' })
    expect(selected).toBeInTheDocument()
    expect(selected).toHaveAttribute('aria-pressed', 'true')
  })

  it('fires onSelect with the category id', async () => {
    const user = userEvent.setup({ delay: null })
    const onSelect = vi.fn()
    render(<CategoryPicker categories={makeCategories(3)} selectedId={null} onSelect={onSelect} />)
    await user.click(screen.getByRole('button', { name: 'Cat 1' }))
    expect(onSelect).toHaveBeenCalledWith('c1')
  })
})
