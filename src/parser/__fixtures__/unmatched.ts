import type { Fixture } from './fixtureTypes'

/**
 * Messages the deterministic pattern table must NOT guess at — these prove
 * `parseMpesaMessage` fails closed (returns `unmatched`) instead of
 * fabricating a bad match. In production these route to the LLM fallback;
 * per-consent, the raw text is stored so a real deterministic pattern can
 * be authored from the miss later.
 */
export const unmatchedFixtures: Fixture[] = [
  {
    description: 'empty string',
    raw: '',
    expected: 'unmatched',
  },
  {
    description: 'unrelated Safaricom OTP message',
    raw: 'Your OTP for login is 348219. Do not share it with anyone.',
    expected: 'unmatched',
  },
  {
    description: 'statement-ready notice, not a transaction at all',
    raw: 'Dear Customer, your M-PESA statement for June 2026 is ready. Visit your nearest Safaricom shop to collect it.',
    expected: 'unmatched',
  },
  {
    description: 'malformed calendar date (day 32, month 13) — must not guess a timestamp',
    raw: 'AB1234567 Confirmed. Ksh500.00 sent to JOHN DOE 0722123456 on 32/13/26 at 3:15 PM. New M-PESA balance is Ksh700.00.',
    expected: 'unmatched',
  },
  {
    description: 'garbled/truncated SMS missing the transaction code',
    raw: 'You have received Ksh500 from someone, ref missing',
    expected: 'unmatched',
  },
  {
    description: 'random noise, no recognizable structure',
    raw: 'asdkjhaskjdh 12345 !!!',
    expected: 'unmatched',
  },
  {
    description: 'balance-inquiry response, not a transaction',
    raw: 'AB9988776 Your M-PESA balance was Ksh4,500.00 on 1/7/26 at 9:00 AM.',
    expected: 'unmatched',
  },
]
