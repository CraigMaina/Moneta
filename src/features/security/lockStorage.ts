import { del, get, set } from 'idb-keyval'
import type { PinRecord } from './pinCrypto'

/**
 * IndexedDB-backed persistence for the app lock (PRD F11) — never localStorage
 * (CLAUDE.md). Holds the PIN hash record and the optional biometric config
 * (whether device-biometric quick-unlock is enabled and the WebAuthn credential
 * id to assert against). This is device-local: it survives reloads but is wiped
 * by "delete all data" and by a forgotten-PIN sign-out.
 */

const PIN_KEY = 'moneta-lock-pin'
const BIOMETRIC_KEY = 'moneta-lock-biometric'

export interface BiometricConfig {
  enabled: boolean
  /** base64url WebAuthn credential id to allow on unlock. */
  credentialId: string
}

export async function getPinRecord(): Promise<PinRecord | null> {
  return (await get<PinRecord>(PIN_KEY)) ?? null
}

export async function setPinRecord(record: PinRecord): Promise<void> {
  await set(PIN_KEY, record)
}

export async function clearPinRecord(): Promise<void> {
  await del(PIN_KEY)
}

export async function getBiometricConfig(): Promise<BiometricConfig | null> {
  return (await get<BiometricConfig>(BIOMETRIC_KEY)) ?? null
}

export async function setBiometricConfig(config: BiometricConfig): Promise<void> {
  await set(BIOMETRIC_KEY, config)
}

export async function clearBiometricConfig(): Promise<void> {
  await del(BIOMETRIC_KEY)
}

/** Wipe every lock artefact — used by delete-all-data and forgotten-PIN sign-out. */
export async function clearAllLockData(): Promise<void> {
  await Promise.all([clearPinRecord(), clearBiometricConfig()])
}
