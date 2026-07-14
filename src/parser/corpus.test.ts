import { describe, expect, it } from 'vitest'
import { allFixtures } from './__fixtures__'
import { parseMpesaMessage } from './index'
import type { MpesaFamily, ParsedMpesaMessage } from './types'

/**
 * The corpus accuracy gate (PRD §F2 / CLAUDE.md: "≥ 98% field-level accuracy
 * on the fixture corpus"). This scores FIELDS, not just pass/fail per
 * message — a fixture that gets 11/12 fields right contributes 11 correct +
 * 1 wrong, not a single failure, matching "count correct fields / total
 * expected fields" from the brief.
 */

const FIELD_NAMES = [
  'amountCents',
  'kind',
  'feeCents',
  'merchant',
  'accountReference',
  'mpesaRef',
  'occurredAt',
  'newBalanceCents',
  'category',
  'family',
  'counterAccountHint',
  'transferDirection',
  'reversalOfRef',
  'patternId',
  'parserVersion',
  // rawText intentionally excluded from scoring: it's an echo of the input,
  // not an extracted field, and would trivially inflate accuracy.
] as const

interface ScoreResult {
  correct: number
  total: number
  mismatches: string[]
}

function scoreFixture(description: string, raw: string, expected: ParsedMpesaMessage | 'unmatched'): ScoreResult {
  const result = parseMpesaMessage(raw)
  const mismatches: string[] = []

  if (expected === 'unmatched') {
    const ok = result.status === 'unmatched'
    if (!ok) mismatches.push(`[${description}] expected unmatched, got status="${result.status}"`)
    return { correct: ok ? 1 : 0, total: 1, mismatches }
  }

  // "status correct" is itself one scored field.
  let correct = 0
  let total = 1
  if (result.status === 'matched') {
    correct += 1
  } else {
    mismatches.push(`[${description}] expected matched, got unmatched`)
  }

  for (const field of FIELD_NAMES) {
    total += 1
    const expectedValue = expected[field]
    const actualValue = result.status === 'matched' ? result.data[field] : undefined
    if (actualValue === expectedValue) {
      correct += 1
    } else {
      mismatches.push(`[${description}] field "${field}": expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actualValue)}`)
    }
  }

  return { correct, total, mismatches }
}

describe('parser corpus — field-level accuracy', () => {
  it(`achieves >= 98% field accuracy across ${allFixtures.length} fixtures`, () => {
    let correct = 0
    let total = 0
    const allMismatches: string[] = []

    for (const fixture of allFixtures) {
      const score = scoreFixture(fixture.description, fixture.raw, fixture.expected)
      correct += score.correct
      total += score.total
      allMismatches.push(...score.mismatches)
    }

    const accuracy = (correct / total) * 100
    // Deliberate: the brief asks the corpus test to print the exact percentage.
    console.log(
      `Parser corpus: ${allFixtures.length} fixtures, ${correct}/${total} fields correct (${accuracy.toFixed(2)}%).`,
    )
    if (allMismatches.length > 0) {
      console.log('Mismatches:\n' + allMismatches.join('\n'))
    }

    expect(allFixtures.length).toBeGreaterThanOrEqual(60)
    expect(accuracy).toBeGreaterThanOrEqual(98)
  })

  it('every fixture family is represented', () => {
    const families = new Set(
      allFixtures
        .map((f) => (f.expected === 'unmatched' ? null : f.expected.family))
        .filter((f): f is MpesaFamily => f !== null),
    )
    const expectedFamilies: MpesaFamily[] = [
      'received',
      'sent_to_person',
      'paybill',
      'buy_goods',
      'pochi_la_biashara',
      'withdrawal',
      'deposit',
      'airtime',
      'fuliza_drawdown',
      'fuliza_repayment',
      'mshwari_kcb_transfer',
      'reversal',
    ]
    for (const family of expectedFamilies) {
      expect(families.has(family)).toBe(true)
    }
  })
})
