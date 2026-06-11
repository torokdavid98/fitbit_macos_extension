import { createHash, randomBytes } from 'crypto'
import { createServer } from 'http'
import { shell } from 'electron'
import { GOOGLE_HEALTH_SCOPES } from '../shared/config'
import { resolveClientId, resolveClientSecret } from './credStore'

// Google OAuth2 endpoints.
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'

// Desktop ("installed") OAuth client. PKCE is used regardless; Google's token
// endpoint for installed clients still accepts the (non-confidential) client
// secret, so we send it when present. Creds come from the in-app store first,
// then env vars (see credStore). Read lazily so in-app setup takes effect.
const clientId = () => resolveClientId()
const clientSecret = () => resolveClientSecret()

export const hasClientId = (): boolean => Boolean(resolveClientId())

export interface TokenSet {
  accessToken: string
  refreshToken: string
  expiresAt: number // epoch ms
}

const b64url = (buf: Buffer) =>
  buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

function pkcePair() {
  const verifier = b64url(randomBytes(32))
  const challenge = b64url(createHash('sha256').update(verifier).digest())
  return { verifier, challenge }
}

// Interactive login: spin a loopback server, open the consent page, capture the
// auth code on redirect, exchange it (with PKCE verifier) for tokens.

// Only one auth flow at a time; re-invoking cancels the previous one so a stale
// loopback server never blocks a retry.
let activeServer: ReturnType<typeof createServer> | null = null
const AUTH_TIMEOUT_MS = 3 * 60 * 1000

export async function runAuthFlow(): Promise<TokenSet> {
  if (!clientId()) throw new Error('GOOGLE_OAUTH_CLIENT_ID not set')
  const { verifier, challenge } = pkcePair()

  // Tear down any pending flow from a prior click.
  if (activeServer) {
    activeServer.close()
    activeServer = null
  }

  let redirectUri = ''
  const code = await new Promise<string>((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '', 'http://127.0.0.1')
      const authCode = url.searchParams.get('code')
      const err = url.searchParams.get('error')
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('<html><body>You can close this window and return to Fitbit macOS Extension.</body></html>')
      cleanup()
      if (err) reject(new Error(`OAuth error: ${err}`))
      else if (authCode) resolve(authCode)
      else reject(new Error('No authorization code returned'))
    })
    activeServer = server

    // Don't hang forever if the user never finishes in the browser.
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('Authorization timed out'))
    }, AUTH_TIMEOUT_MS)

    function cleanup(): void {
      clearTimeout(timer)
      server.close()
      if (activeServer === server) activeServer = null
    }

    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number }
      redirectUri = `http://127.0.0.1:${port}`
      const params = new URLSearchParams({
        client_id: clientId(),
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: GOOGLE_HEALTH_SCOPES.join(' '),
        code_challenge: challenge,
        code_challenge_method: 'S256',
        access_type: 'offline',
        prompt: 'consent'
      })
      shell.openExternal(`${AUTH_URL}?${params.toString()}`)
    })

    server.on('error', (e) => {
      cleanup()
      reject(e)
    })
  })

  return exchange({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier
  })
}

// Refresh an expired access token.
export async function refreshTokens(refreshToken: string): Promise<TokenSet> {
  if (!clientId()) throw new Error('GOOGLE_OAUTH_CLIENT_ID not set')
  const set = await exchange({ grant_type: 'refresh_token', refresh_token: refreshToken })
  // Google omits refresh_token on refresh — keep the existing one.
  return { ...set, refreshToken: set.refreshToken || refreshToken }
}

async function exchange(extra: Record<string, string>): Promise<TokenSet> {
  const body = new URLSearchParams({ client_id: clientId(), ...extra })
  const secret = clientSecret()
  if (secret) body.set('client_secret', secret)
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`)
  const json = (await res.json()) as {
    access_token: string
    refresh_token?: string
    expires_in: number
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? '',
    expiresAt: Date.now() + json.expires_in * 1000
  }
}
