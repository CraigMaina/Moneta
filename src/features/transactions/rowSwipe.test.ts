import { describe, expect, it } from 'vitest'
import { resolveRowSwipeAction } from './rowSwipe'

describe('resolveRowSwipeAction', () => {
  it('commits delete past the left offset threshold', () => {
    expect(resolveRowSwipeAction(-97, 0)).toBe('delete')
    expect(resolveRowSwipeAction(-96, 0)).toBe(null)
  })

  it('commits delete past the left velocity threshold', () => {
    expect(resolveRowSwipeAction(-10, -501)).toBe('delete')
    expect(resolveRowSwipeAction(-10, -500)).toBe(null)
  })

  it('commits recategorize past the right offset threshold', () => {
    expect(resolveRowSwipeAction(97, 0)).toBe('recategorize')
    expect(resolveRowSwipeAction(96, 0)).toBe(null)
  })

  it('commits recategorize past the right velocity threshold', () => {
    expect(resolveRowSwipeAction(10, 501)).toBe('recategorize')
    expect(resolveRowSwipeAction(10, 500)).toBe(null)
  })

  it('snaps back (no action) for a small, slow drag', () => {
    expect(resolveRowSwipeAction(30, 40)).toBe(null)
    expect(resolveRowSwipeAction(0, 0)).toBe(null)
  })
})
