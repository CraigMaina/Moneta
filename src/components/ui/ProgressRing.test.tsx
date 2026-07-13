import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { clampProgress, ProgressRing } from './ProgressRing'

describe('clampProgress', () => {
  it('passes through valid values unchanged', () => {
    expect(clampProgress(0)).toBe(0)
    expect(clampProgress(0.25)).toBe(0.25)
    expect(clampProgress(1)).toBe(1)
  })

  it('clamps below zero up to zero', () => {
    expect(clampProgress(-0.5)).toBe(0)
    expect(clampProgress(-1000)).toBe(0)
  })

  it('clamps above one down to one', () => {
    expect(clampProgress(1.5)).toBe(1)
    expect(clampProgress(1000)).toBe(1)
  })

  it('treats NaN and Infinity as zero (a division-by-zero upstream should never crash the ring)', () => {
    expect(clampProgress(Number.NaN)).toBe(0)
    expect(clampProgress(Number.POSITIVE_INFINITY)).toBe(0)
    expect(clampProgress(Number.NEGATIVE_INFINITY)).toBe(0)
  })
})

describe('ProgressRing', () => {
  it('sizes the wrapper to the requested diameter', () => {
    const { container } = render(<ProgressRing progress={0.5} size={140} />)
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper).toHaveStyle({ width: '140px', height: '140px' })
  })

  it('is decorative (no role) when no label is given, so children carry the accessible text', () => {
    render(
      <ProgressRing progress={0.6}>
        <span>60%</span>
      </ProgressRing>,
    )
    expect(screen.getByText('60%')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('exposes an accessible label when one is given', () => {
    render(<ProgressRing progress={0.6} label="60 percent to goal" />)
    expect(screen.getByRole('img', { name: '60 percent to goal' })).toBeInTheDocument()
  })

  it('renders center content in front of the ring', () => {
    render(
      <ProgressRing progress={0.25}>
        <span>Center</span>
      </ProgressRing>,
    )
    expect(screen.getByText('Center')).toBeInTheDocument()
  })
})
