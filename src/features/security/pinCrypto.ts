/**
 * PIN hashing for the app lock (PRD F11). The PIN is a *local* convenience gate
 * on top of the real security boundary (Supabase auth + RLS) — it is NEVER sent
 * anywhere and the raw PIN is never stored. We keep only a PBKDF2-SHA-256 hash
 * with a per-device random salt, verified with a constant-time compare.
 *
 * WebCrypto (`crypto.subtle`) does the KDF; everything else here is pure and
 * unit-tested. No `localStorage` — the record lives in IndexedDB (see
 * `lockStorage.ts`), consistent with CLAUDE.md's local-storage rule.
 */

export interface PinRecord {
  /** Hex-encoded random salt. */
  salt: string
  /** Hex-encoded PBKDF2 derived key. */
  hash: string
  iterations: number
}

export const PIN_ITERATIONS = 210_000
const KEY_BITS = 256

function toHex(bytes: Uint8Array): string {
  let out = ''
  for (const b of bytes) out += b.toString(16).padStart(2, '0')
  return out
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(hex.length / 2))
  for (let i = 0; i < bytes.length; i++) bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return bytes
}

/** A fresh 16-byte random salt, hex-encoded. */
export function randomSalt(): string {
  const salt = new Uint8Array(16)
  crypto.getRandomValues(salt)
  return toHex(salt)
}

/**
 * Constant-time equality of two hex strings — avoids leaking how much of the
 * hash matched via timing. Length mismatch returns false (still fixed-time over
 * the shorter operand).
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function derive(pin: string, saltHex: string, iterations: number): Promise<string> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: fromHex(saltHex), iterations, hash: 'SHA-256' },
    keyMaterial,
    KEY_BITS,
  )
  return toHex(new Uint8Array(bits))
}

/** Build a storable record for a new/changed PIN. */
export async function hashPin(pin: string, iterations: number = PIN_ITERATIONS): Promise<PinRecord> {
  const salt = randomSalt()
  const hash = await derive(pin, salt, iterations)
  return { salt, hash, iterations }
}

/** True when `pin` matches the stored record (constant-time). */
export async function verifyPin(pin: string, record: PinRecord): Promise<boolean> {
  const hash = await derive(pin, record.salt, record.iterations)
  return constantTimeEqual(hash, record.hash)
}
