// The single data model the whole UI renders. Provider-agnostic on purpose:
// mock and Google Health both produce this shape, so the renderer never changes.

export type SleepStageType = 'AWAKE' | 'LIGHT' | 'DEEP' | 'REM' | string

export interface SleepStage {
  type: SleepStageType
  start: number // epoch ms
  end: number // epoch ms
}

export interface Stats {
  steps: number | null
  // Most recent intraday heart-rate sample (Google Health `heart-rate`, intraday list).
  latestHeartRate: number | null // bpm
  restingHeartRate: number | null // bpm (`daily-resting-heart-rate`)
  hrv: number | null // ms (`heart-rate-variability`)
  sleepMinutes: number | null // total sleep last night (`sleep` session)
  spo2: number | null // % oxygen saturation (`oxygen-saturation`)
  activeCalories: number | null // kcal (`active-energy-burned`)
  // today's intraday heart-rate samples, ascending by time, for the chart
  heartRateSeries: Array<{ t: number; bpm: number }>
  // most-recent night's sleep stages, for the sleep chart
  sleepStages: SleepStage[]
  // source platform per metric (e.g. 'FITBIT', 'HEALTH_KIT'), for display
  sources: Partial<Record<NumericStatKey, string>>
  updatedAt: number // epoch ms when these stats were produced
}

// Stat keys whose value is a single number (the card metrics).
export type NumericStatKey = Exclude<
  keyof Stats,
  'updatedAt' | 'heartRateSeries' | 'sources' | 'sleepStages'
>

export type AuthStatus = 'authed' | 'unauthed' | 'mock'

export interface HealthProvider {
  /** Latest stats. Throws if not authed (except mock, which never is). */
  getStats(): Promise<Stats>
  status(): Promise<AuthStatus>
  /** Kick off interactive login. No-op for mock. */
  login(): Promise<void>
  /** Clear stored tokens. No-op for mock. */
  logout(): Promise<void>
}
