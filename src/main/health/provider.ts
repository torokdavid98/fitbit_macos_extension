import { USE_MOCK } from '../../shared/config'
import { getSettings } from '../settings'
import { GoogleHealthProvider } from './googleHealth'
import { MockProvider } from './mock'
import type { HealthProvider } from './types'

let instance: HealthProvider | null = null

// Provider selection: demo toggle (or the dev USE_MOCK flag) -> mock; otherwise
// the real Google Health provider, which reports 'unconfigured' until creds are
// entered in-app. No source edits needed to go live.
export function getProvider(): HealthProvider {
  if (!instance) {
    const demo = USE_MOCK || getSettings().demo === true
    instance = demo ? new MockProvider() : new GoogleHealthProvider()
  }
  return instance
}

// Drop the cached instance so the next getProvider() re-evaluates (after the
// user enters credentials or toggles demo mode).
export function resetProvider(): void {
  instance = null
}
