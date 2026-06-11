import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'
import { app, safeStorage } from 'electron'
import type { TokenSet } from './oauth'

// Tokens encrypted at rest via Electron safeStorage (Keychain-backed on macOS),
// stored in the app's userData dir.
function file(): string {
  return join(app.getPath('userData'), 'tokens.enc')
}

export function saveTokens(tokens: TokenSet): void {
  const plaintext = JSON.stringify(tokens)
  const data = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(plaintext)
    : Buffer.from(plaintext, 'utf8') // fallback (e.g. CI without Keychain)
  writeFileSync(file(), data)
}

export function loadTokens(): TokenSet | null {
  const path = file()
  if (!existsSync(path)) return null
  try {
    const data = readFileSync(path)
    const plaintext = safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(data)
      : data.toString('utf8')
    return JSON.parse(plaintext) as TokenSet
  } catch {
    return null
  }
}

export function clearTokens(): void {
  const path = file()
  if (existsSync(path)) unlinkSync(path)
}
