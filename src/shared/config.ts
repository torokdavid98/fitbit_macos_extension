// Shared config. Imported by both main and (indirectly) renderer.

// Flip to false once a Google Cloud OAuth desktop client is provisioned (Phase 3).
export const USE_MOCK = false

// How often the renderer asks the main process for fresh stats.
export const REFRESH_INTERVAL_MS = 5 * 60 * 1000 // 5 min

// Google Health API OAuth read scopes. Must be ".readonly" — without the suffix
// Google rejects the authorize request with a 400.
//   activity_and_fitness        -> steps, distance, active energy, zone minutes
//   health_metrics_and_measurements -> heart rate, resting HR, HRV, SpO2
//   sleep                       -> sleep sessions
// These must also be selected on the project's Data Access page in Cloud Console.
export const GOOGLE_HEALTH_SCOPES = [
  'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly',
  'https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly',
  'https://www.googleapis.com/auth/googlehealth.sleep.readonly'
]

export const GOOGLE_HEALTH_API_BASE = 'https://health.googleapis.com/v4'
