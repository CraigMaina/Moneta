import { describe, expect, it } from 'vitest'
import { constantTimeEqual, hashPin, randomSalt, verifyPin } from './pinCrypto'

const hasSubtle = typeof globalThis.crypto?.subtle?.deriveBits === 'function'

describe('constantTimeEqual', () => {
  it('is true only for identical strings', () => {
    expect(constantTimeEqual('abc123', 'abc123')).toBe(true)
    expect(constantTimeEqual('abc123', 'abc124')).toBe(false)
  })

  it('is false for length mismatch', () => {
    expect(constantTimeEqual('abc', 'abcd')).toBe(false)
  })
})

describe('randomSalt', () => {
  it('is 16 bytes of hex and unique per call', () => {
    const a = randomSalt()
    const b = randomSalt()
    expect(a).toMatch(/^[0-9a-f]{32}$/)
    expect(a).not.toBe(b)
  })
})

describe.runIf(hasSubtle)('hashPin / verifyPin', () => {
  it('verifies the correct PIN and rejects a wrong one', async () => {
    const record = await hashPin('1234', 1000)
    expect(await verifyPin('1234', record)).toBe(true)
    expect(await verifyPin('4321', record)).toBe(false)
  })

  it('salts each record so two hashes of the same PIN differ', async () => {
    const a = await hashPin('0000', 1000)
    const b = await hashPin('0000', 1000)
    expect(a.hash).not.toBe(b.hash)
    // ...but each still verifies its own PIN.
    expect(await verifyPin('0000', a)).toBe(true)
    expect(await verifyPin('0000', b)).toBe(true)
  })
})
