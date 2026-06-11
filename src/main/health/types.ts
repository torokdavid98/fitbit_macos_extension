// The single data model the whole UI renders. Provider-agnostic on purpose:
// mock and Google Health both produce this shape, so the renderer never changes.

export interface Stats {
  steps: number | null
  restingHeartRate: number | null // bpm
  hrv: number | null // ms (daily HRV)
  sleepMinutes: number | null // total sleep last night
  spo2: number | null // % oxygen saturation
  updatedAt: number // epoch ms when these stats were produced
}

export type AuthStatus = 'authed' | 'unauthed' | 'mock'

export interface HealthProvider {
  /** Latest stats. Throws if not authed (except mock, which never is). */
  getStats(): Promise<Stats>
  status(): Promise<AuthStatus>
  /** Kick off interactive login. No-op for mock. */
  login(): Promise<void>
}
