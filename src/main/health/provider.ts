import { USE_MOCK } from '../../shared/config'
import { GoogleHealthProvider } from './googleHealth'
import { MockProvider } from './mock'
import type { HealthProvider } from './types'

let instance: HealthProvider | null = null

// Single swap point. USE_MOCK in shared/config.ts decides the impl.
export function getProvider(): HealthProvider {
  if (!instance) {
    instance = USE_MOCK ? new MockProvider() : new GoogleHealthProvider()
  }
  return instance
}
