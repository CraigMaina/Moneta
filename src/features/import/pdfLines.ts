/**
 * Pure text-line reconstruction from positioned PDF text fragments (PRD F5, PDF
 * path). pdf.js hands back text as many small items, each with an (x, y) origin
 * rather than as lines — so to feed the M-PESA statement into `parseStatement`
 * (which is line-oriented) we regroup fragments that share a baseline into one
 * line, left-to-right. Kept free of any pdf.js import so the grouping heuristic
 * — the brittle part — is unit-testable in isolation.
 */

export interface PositionedText {
  str: string
  /** Horizontal origin (PDF user space; larger = further right). */
  x: number
  /** Vertical origin (PDF user space; larger = higher on the page). */
  y: number
}

// Fragments whose baselines differ by less than this (PDF units ≈ points) are
// treated as the same visual line. M-PESA rows are single-line height, so a
// small tolerance groups a row's cells without merging adjacent rows.
const LINE_Y_TOLERANCE = 3

/** Regroup positioned fragments into text lines, top-to-bottom, each left-to-right. */
export function reconstructLines(items: PositionedText[]): string[] {
  const usable = items.filter((it) => it.str.trim().length > 0)
  // Top-to-bottom: PDF y increases upward, so sort descending. Ties by x.
  usable.sort((a, b) => b.y - a.y || a.x - b.x)

  const lines: string[] = []
  let lineItems: PositionedText[] = []
  let lineY: number | null = null

  const flush = () => {
    if (lineItems.length === 0) return
    const text = [...lineItems]
      .sort((a, b) => a.x - b.x)
      .map((it) => it.str)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (text.length > 0) lines.push(text)
    lineItems = []
  }

  for (const item of usable) {
    if (lineY === null || Math.abs(item.y - lineY) <= LINE_Y_TOLERANCE) {
      lineItems.push(item)
      if (lineY === null) lineY = item.y
    } else {
      flush()
      lineItems.push(item)
      lineY = item.y
    }
  }
  flush()
  return lines
}
