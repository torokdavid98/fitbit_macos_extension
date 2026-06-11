// Shared config. Imported by both main and (indirectly) renderer.

// Flip to false once a Google Cloud OAuth desktop client is provisioned (Phase 3).
export const USE_MOCK = true

// How often the renderer asks the main process for fresh stats.
export const REFRESH_INTERVAL_MS = 5 * 60 * 1000 // 5 min

// Google Health API OAuth scopes (read). Exact read-scope strings to be confirmed
// at developers.google.com/health/setup — examples in the docs lean write-only.
export const GOOGLE_HEALTH_SCOPES = [
  'https://www.googleapis.com/auth/googlehealth.activity_and_fitness',
  'https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements'
]

export const GOOGLE_HEALTH_API_BASE = 'https://health.googleapis.com/v4'
