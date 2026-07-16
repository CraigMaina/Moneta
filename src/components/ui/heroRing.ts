import { useEffect, useRef, useState, type RefObject } from 'react'
import { formatKES } from '../../lib/money'

/**
 * Shared sizing for the Home hero rings (safe-to-spend, daily-spend). The ring
 * shrinks to fit its container on narrow screens (small iPhones) so it never
 * pushes the page wider than the viewport, but caps at 260 so it stays the calm
 * centrepiece on roomier screens. The numeral shrinks to fit the ring's inner
 * width so a large amount never wraps out of the ring ("numbers falling").
 */

export const RING_MAX_SIZE = 260
export const RING_MIN_SIZE = 208
export const RING_STROKE = 16

const HERO_MAX_PX = 52
const HERO_MIN_PX = 28

/**
 * Font size (px) for the hero numeral so the formatted amount fits on one line
 * inside the ring. Character advances are approximate (tabular figures ~0.6em,
 * separators ~0.28em); the fit only needs to be close, not pixel-perfect.
 */
export function heroNumeralPx(cents: number, ringSize: number): number {
  const text = formatKES(cents, { withSymbol: false })
  let ems = 0
  for (const ch of text) {
    if (ch >= '0' && ch <= '9') ems += 0.6
    else if (ch === ',' || ch === '.') ems += 0.28
    else ems += 0.34
  }
  if (ems === 0) return HERO_MAX_PX
  // px-6 padding (24px each side) sits between the numeral and the ring edge.
  const innerWidth = ringSize - 48
  return Math.max(HERO_MIN_PX, Math.min(HERO_MAX_PX, innerWidth / ems))
}

/**
 * Measures the available width and shrinks the ring to fit. ResizeObserver is an
 * external system, so subscribing here is fine; guarded for jsdom, which ships
 * no ResizeObserver (the ring stays at max there).
 */
export function useResponsiveRingSize(): { ref: RefObject<HTMLDivElement>; ringSize: number } {
  const ref = useRef<HTMLDivElement>(null)
  const [ringSize, setRingSize] = useState(RING_MAX_SIZE)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? RING_MAX_SIZE
      setRingSize(Math.max(RING_MIN_SIZE, Math.min(RING_MAX_SIZE, Math.floor(width))))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return { ref, ringSize }
}
