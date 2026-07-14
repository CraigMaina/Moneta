import { describe, expect, it } from 'vitest'
import { extractSharedText } from './shareTarget'

describe('extractSharedText', () => {
  it('returns a shared M-PESA SMS from `text`', () => {
    const sms = 'QGH7XXXXX1 Confirmed. You have received Ksh1,500.00 from JOHN KAMAU on 5/7/26 at 2:45 PM.'
    expect(extractSharedText({ text: sms })).toBe(sms)
  })

  it('combines text and url when both are shared', () => {
    expect(extractSharedText({ text: 'Confirmed. Ksh500', url: 'https://x.co/a' })).toBe('Confirmed. Ksh500 https://x.co/a')
  })

  it('falls back to title when there is no text or url', () => {
    expect(extractSharedText({ title: 'A note' })).toBe('A note')
  })

  it('returns null when nothing usable was shared', () => {
    expect(extractSharedText({})).toBeNull()
    expect(extractSharedText({ text: '   ', url: null, title: '' })).toBeNull()
  })
})
