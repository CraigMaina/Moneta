import { setBiometricConfig, type BiometricConfig } from './lockStorage'

/**
 * Optional device-biometric quick-unlock via WebAuthn platform authenticator
 * (PRD F11 "PIN/biometrics"). This is a *local convenience* on top of the PIN —
 * a successful user-verifying platform assertion unlocks the app. There's no
 * server verification (the security boundary is Supabase auth); we only need
 * the device to prove the same authenticator, so a random challenge is fine.
 *
 * Everything is capability-detected and wrapped so an unsupported or cancelled
 * ceremony is a clean `false`, never a crash — the PIN path always remains.
 */

function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(length))
  crypto.getRandomValues(bytes)
  return bytes
}

function toBase64Url(bytes: ArrayBuffer): string {
  const b = new Uint8Array(bytes)
  let str = ''
  for (const byte of b) str += String.fromCharCode(byte)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice((value.length + 3) % 4)
  const str = atob(padded)
  const bytes = new Uint8Array(new ArrayBuffer(str.length))
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i)
  return bytes
}

/** True when a user-verifying platform authenticator (Face ID / fingerprint / Windows Hello) is available. */
export async function isBiometricSupported(): Promise<boolean> {
  try {
    if (typeof window === 'undefined' || !window.PublicKeyCredential) return false
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

/**
 * Register a platform credential and persist its id. Returns true on success.
 * `userId` scopes the WebAuthn user handle to the signed-in account.
 */
export async function enrollBiometric(userId: string): Promise<boolean> {
  try {
    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge: randomBytes(32),
        rp: { name: 'Moneta' },
        user: { id: new TextEncoder().encode(userId), name: 'Moneta user', displayName: 'Moneta user' },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 }, // ES256
          { type: 'public-key', alg: -257 }, // RS256
        ],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
        timeout: 60_000,
      },
    })) as PublicKeyCredential | null
    if (!credential) return false

    const config: BiometricConfig = { enabled: true, credentialId: toBase64Url(credential.rawId) }
    await setBiometricConfig(config)
    return true
  } catch {
    return false
  }
}

/** Prompt the device biometric and return true if the user verified against the stored credential. */
export async function verifyBiometric(credentialId: string): Promise<boolean> {
  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: randomBytes(32),
        allowCredentials: [{ type: 'public-key', id: fromBase64Url(credentialId) }],
        userVerification: 'required',
        timeout: 60_000,
      },
    })
    return assertion !== null
  } catch {
    return false
  }
}
