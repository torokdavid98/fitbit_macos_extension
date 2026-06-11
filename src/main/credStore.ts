import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'
import { app, safeStorage } from 'electron'

// OAuth client credentials, entered in-app and stored encrypted (Keychain).
// Lets a cloned app be configured without editing .env or any source file.
export interface Creds {
  id: string
  secret: string
}

function file(): string {
  return join(app.getPath('userData'), 'creds.enc')
}

export function saveCreds(creds: Creds): void {
  const plain = JSON.stringify(creds)
  const data = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(plain)
    : Buffer.from(plain, 'utf8')
  writeFileSync(file(), data)
}

export function loadCreds(): Creds | null {
  try {
    const path = file()
    if (!existsSync(path)) return null
    const data = readFileSync(path)
    const plain = safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(data)
      : data.toString('utf8')
    const c = JSON.parse(plain) as Creds
    return c.id ? c : null
  } catch {
    return null
  }
}

export function clearCreds(): void {
  const path = file()
  if (existsSync(path)) unlinkSync(path)
}

// Resolve client id/secret from the in-app store first, then env vars.
export function resolveClientId(): string {
  return loadCreds()?.id ?? process.env['GOOGLE_OAUTH_CLIENT_ID'] ?? ''
}

export function resolveClientSecret(): string {
  return loadCreds()?.secret ?? process.env['GOOGLE_OAUTH_CLIENT_SECRET'] ?? ''
}

// Parse the JSON file Google gives you for a Desktop OAuth client, or a JSON
// object with {client_id, client_secret}. Returns null if nothing usable.
export function parseGoogleClientJson(text: string): Creds | null {
  try {
    const obj = JSON.parse(text)
    const node = obj.installed ?? obj.web ?? obj
    const id = node.client_id ?? node.clientId ?? obj.client_id
    const secret = node.client_secret ?? node.clientSecret ?? obj.client_secret ?? ''
    if (typeof id === 'string' && id.includes('.apps.googleusercontent.com')) {
      return { id, secret: typeof secret === 'string' ? secret : '' }
    }
    return null
  } catch {
    return null
  }
}
