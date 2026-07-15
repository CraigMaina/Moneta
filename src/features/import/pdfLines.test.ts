import { describe, expect, it } from 'vitest'
import { reconstructLines, type PositionedText } from './pdfLines'
import { parseStatement } from './statementParser'

// Two statement rows' worth of fragments, deliberately out of reading order and
// with small baseline jitter, to prove grouping is by y (not input order).
function frag(str: string, x: number, y: number): PositionedText {
  return { str, x, y }
}

describe('reconstructLines', () => {
  it('groups fragments sharing a baseline into one left-to-right line, top-to-bottom', () => {
    const items: PositionedText[] = [
      // Row 2 (lower on page, y=700) — supplied first to test ordering.
      frag('1,050.00', 500, 700),
      frag('SGH8YDEF34', 60, 700.5),
      frag('Pay Bill to KPLC', 200, 699.8),
      // Row 1 (higher on page, y=720)
      frag('SGH7XABC12', 60, 720),
      frag('Sent to John', 200, 720),
      frag('1,500.00', 500, 719.5),
    ]
    expect(reconstructLines(items)).toEqual([
      'SGH7XABC12 Sent to John 1,500.00',
      'SGH8YDEF34 Pay Bill to KPLC 1,050.00',
    ])
  })

  it('drops empty/whitespace fragments', () => {
    const items = [frag('  ', 10, 100), frag('Hello', 20, 100), frag('', 30, 100)]
    expect(reconstructLines(items)).toEqual(['Hello'])
  })

  it('reconstructs a statement row that parseStatement can read end-to-end', () => {
    // Fragments as pdf.js would yield them for one real row.
    const items: PositionedText[] = [
      frag('SGI1BMNO90', 60, 500),
      frag('2026-06-03', 150, 500),
      frag('10:05:44', 240, 500),
      frag('Merchant Payment to Naivas Supermarket', 330, 500),
      frag('Completed', 620, 500),
      frag('0.00', 700, 500),
      frag('2,340.50', 770, 500),
      frag('4,781.50', 850, 500),
    ]
    const text = reconstructLines(items).join('\n')
    const { candidates } = parseStatement(text)
    expect(candidates).toHaveLength(1)
    expect(candidates[0]).toMatchObject({
      mpesaRef: 'SGI1BMNO90',
      kind: 'expense',
      amountCents: 234050,
      merchant: 'Naivas Supermarket',
    })
  })
})
