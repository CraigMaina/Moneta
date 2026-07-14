import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { accountIcon, categoryIcon } from './iconMaps'

/**
 * The `icon` column holds either a seeded ASCII slug ('shopping-basket',
 * 'smartphone') that maps to an SVG glyph, or a user-picked emoji rendered
 * as text. These pin the emoji-vs-slug discrimination so a slug is never
 * shown as literal text and an emoji is never swallowed into a fallback SVG.
 */
describe('categoryIcon', () => {
  it('renders a custom emoji as text', () => {
    const { container } = render(categoryIcon({ icon: '🐄' }))
    expect(container.textContent).toBe('🐄')
  })

  it('renders a known seed slug as an SVG glyph (no literal text)', () => {
    const { container } = render(categoryIcon({ icon: 'shopping-basket' }))
    expect(container.textContent).toBe('')
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('falls back to an SVG (never literal text) for an unmapped slug', () => {
    const { container } = render(categoryIcon({ icon: 'heart' }))
    expect(container.textContent).toBe('')
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('falls back to an SVG when there is no icon at all', () => {
    const { container } = render(categoryIcon({ icon: null }))
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
})

describe('accountIcon', () => {
  it('renders a custom emoji as text', () => {
    const { container } = render(accountIcon({ type: 'bank', icon: '🏦' }))
    expect(container.textContent).toBe('🏦')
  })

  it('ignores a seeded slug and uses the type glyph', () => {
    const { container } = render(accountIcon({ type: 'mpesa', icon: 'smartphone' }))
    expect(container.textContent).toBe('')
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
})
