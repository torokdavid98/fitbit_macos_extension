import { GOOGLE_HEALTH_API_BASE } from '../../shared/config'
import { hasClientId, refreshTokens, runAuthFlow, type TokenSet } from '../oauth'
import { clearTokens, loadTokens, saveTokens } from '../tokenStore'
import type { AuthStatus, HealthProvider, NumericStatKey, SleepStage, Stats } from './types'

// A chosen metric value plus the source platform it came from.
type Picked = { value: number; source: string } | null

const platformOf = (p: DataPoint): string =>
  ((p.dataSource as { platform?: string } | undefined)?.platform ?? 'UNKNOWN') as string

// Real provider. OAuth via oauth.ts, tokens via tokenStore.ts.
//
// Endpoint: GET /v4/users/me/dataTypes/{type}/dataPoints
//   -> { dataPoints: [ { dataSource, "<metricObj>": { <timeKeys>, <valueField> } } ] }
//
// Each data point wraps its value in a per-type object (camelCase) that also
// holds time/date fields. We read the value field and skip the time/date ones.
// Confirmed value fields from live data:
//   heartRate.beatsPerMinute, dailyRestingHeartRate.beatsPerMinute,
//   oxygenSaturation.percentage, steps.<count>, activeEnergyBurned.<kcal>,
//   heartRateVariability.<ms>

type Strategy = 'latest' | 'sumToday'

interface Metric {
  key: NumericStatKey
  type: string // kebab-case data type in the URL
  strategy: Strategy
}

const METRICS: Metric[] = [
  { key: 'latestHeartRate', type: 'heart-rate', strategy: 'latest' },
  { key: 'restingHeartRate', type: 'daily-resting-heart-rate', strategy: 'latest' },
  { key: 'steps', type: 'steps', strategy: 'sumToday' },
  { key: 'activeCalories', type: 'active-energy-burned', strategy: 'sumToday' }
  // hrv + spo2 handled separately (source preference + plausible-range guard)
]

// Keys inside a metric object that hold time/date info, not the value.
const TIME_KEYS = new Set([
  'sampleTime',
  'date',
  'time',
  'interval',
  'startTime',
  'endTime',
  'civilTime',
  'civilStartTime',
  'civilEndTime',
  'utcOffset',
  'startUtcOffset',
  'endUtcOffset',
  'physicalTime',
  'timeZone',
  'timezone'
])

export class GoogleHealthProvider implements HealthProvider {
  private tokens: TokenSet | null = loadTokens()

  async status(): Promise<AuthStatus> {
    if (!hasClientId()) return 'unconfigured'
    return this.tokens ? 'authed' : 'unauthed'
  }

  async login(): Promise<void> {
    this.tokens = await runAuthFlow()
    saveTokens(this.tokens)
  }

  async logout(): Promise<void> {
    clearTokens()
    this.tokens = null
  }

  async getStats(): Promise<Stats> {
    const token = await this.validAccessToken()

    const stats: Stats = {
      latestHeartRate: null,
      restingHeartRate: null,
      steps: null,
      activeCalories: null,
      hrv: null,
      sleepMinutes: null,
      spo2: null,
      heartRateSeries: [],
      sleepStages: [],
      sources: {},
      updatedAt: Date.now()
    }

    const set = (key: NumericStatKey, picked: Picked): void => {
      if (picked) {
        stats[key] = picked.value
        stats.sources[key] = picked.source
      }
    }

    try {
      stats.heartRateSeries = await this.fetchHeartRateSeries(token)
    } catch (err) {
      console.error('[health] heart-rate series failed:', (err as Error).message)
    }

    await Promise.all(
      METRICS.map(async (m) => {
        try {
          const filter = m.strategy === 'sumToday' ? todayIntervalFilter(m.type) : undefined
          const points = await this.listDataPoints(token, m.type, filter)
          set(m.key, m.strategy === 'sumToday' ? sumTodayBySource(points) : latestValue(points))
        } catch (err) {
          console.error(`[health] ${m.type} failed:`, (err as Error).message)
        }
      })
    )

    try {
      set('hrv', await this.fetchHrv(token))
    } catch (err) {
      console.error('[health] hrv failed:', (err as Error).message)
    }

    try {
      set('spo2', await this.fetchSpo2(token))
    } catch (err) {
      console.error('[health] spo2 failed:', (err as Error).message)
    }

    try {
      const sleep = await this.fetchSleep(token)
      set('sleepMinutes', sleep.minutes)
      stats.sleepStages = sleep.stages
    } catch (err) {
      console.error('[health] sleep failed:', (err as Error).message)
    }

    return stats
  }

  // HRV = RMSSD in ms. Apple HealthKit often reports 0 here, so skip zeros and
  // prefer Fitbit; fall back to the daily HRV type if intraday has nothing usable.
  private async fetchHrv(token: string): Promise<Picked> {
    const primary = pickHrv(await this.listDataPoints(token, 'heart-rate-variability'))
    if (primary != null) return primary
    try {
      return pickHrv(await this.listDataPoints(token, 'daily-heart-rate-variability'))
    } catch {
      return null
    }
  }

  // SpO2: the app shows a daily average. Intraday samples can be junk (e.g. 50%),
  // so prefer the daily type + a plausible range, falling back to intraday.
  private async fetchSpo2(token: string): Promise<Picked> {
    const daily = await this.listDataPoints(token, 'daily-oxygen-saturation').catch(() => [])
    const fromDaily = latestInRange(daily, 70, 100)
    if (fromDaily != null) return fromDaily
    const intraday = await this.listDataPoints(token, 'oxygen-saturation').catch(() => [])
    return latestInRange(intraday, 70, 100)
  }

  // Today's intraday heart-rate samples, ascending by time, for the chart.
  private async fetchHeartRateSeries(token: string): Promise<Array<{ t: number; bpm: number }>> {
    const points = await this.listDataPoints(token, 'heart-rate')
    const series: Array<{ t: number; bpm: number }> = []
    for (const p of points) {
      const t = pointTime(p)
      const bpm = pointValue(p)
      if (t != null && bpm != null && isToday(t)) series.push({ t, bpm })
    }
    series.sort((a, b) => a.t - b.t)
    return series
  }

  // Sleep is a session type: each data point is one night's session with an
  // interval and stages. Use the most-recent session; report asleep time
  // (sum of stage durations excluding AWAKE), falling back to the interval span.
  private async fetchSleep(token: string): Promise<{ minutes: Picked; stages: SleepStage[] }> {
    const points = await this.listDataPoints(token, 'sleep')
    if (!points.length) return { minutes: null, stages: [] }

    // newest session = max session end time
    let newest: DataPoint | null = null
    let newestT = -Infinity
    for (const p of points) {
      const t = pointTime(p) ?? -Infinity
      if (t > newestT) {
        newestT = t
        newest = p
      }
    }
    if (!newest) return { minutes: null, stages: [] }
    const source = platformOf(newest)

    const sleep = (newest as Record<string, unknown>).sleep as
      | { interval?: { startTime?: string; endTime?: string }; stages?: unknown[] }
      | undefined

    // Parse stage segments.
    const stages: SleepStage[] = []
    if (Array.isArray(sleep?.stages)) {
      for (const st of sleep!.stages as Array<Record<string, unknown>>) {
        if (typeof st.startTime !== 'string' || typeof st.endTime !== 'string') continue
        const start = Date.parse(st.startTime)
        const end = Date.parse(st.endTime)
        if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
          stages.push({ type: String(st.type ?? 'LIGHT'), start, end })
        }
      }
      stages.sort((a, b) => a.start - b.start)
    }

    // Asleep minutes = sum of non-AWAKE stages, else whole session span.
    const asleepMs = stages
      .filter((s) => s.type !== 'AWAKE')
      .reduce((sum, s) => sum + (s.end - s.start), 0)
    if (asleepMs > 0) return { minutes: { value: Math.round(asleepMs / 60000), source }, stages }

    const iv = sleep?.interval
    if (iv?.startTime && iv?.endTime) {
      const d = Date.parse(iv.endTime) - Date.parse(iv.startTime)
      if (Number.isFinite(d) && d > 0) return { minutes: { value: Math.round(d / 60000), source }, stages }
    }
    return { minutes: null, stages }
  }

  // --- token lifecycle ---

  private async validAccessToken(): Promise<string> {
    if (!this.tokens) throw new Error('Not authenticated')
    if (Date.now() >= this.tokens.expiresAt - 60_000) {
      try {
        this.tokens = await refreshTokens(this.tokens.refreshToken)
        saveTokens(this.tokens)
      } catch (err) {
        clearTokens()
        this.tokens = null
        throw err
      }
    }
    return this.tokens.accessToken
  }

  // --- data fetch ---

  private async listDataPoints(
    token: string,
    type: string,
    filter?: string
  ): Promise<DataPoint[]> {
    const params = new URLSearchParams({ page_size: '1000' })
    if (filter) params.set('filter', filter)
    const url = `${GOOGLE_HEALTH_API_BASE}/users/me/dataTypes/${type}/dataPoints?${params}`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
    })
    if (!res.ok) {
      const text = await res.text()
      // A bad filter -> retry once without it rather than dropping the metric.
      if (filter && (res.status === 400 || res.status === 422)) {
        console.warn(`[health] ${type} filter rejected (${res.status}), retrying unfiltered`)
        return this.listDataPoints(token, type)
      }
      throw new Error(`${res.status} ${text.slice(0, 200)}`)
    }
    const json = (await res.json()) as { dataPoints?: DataPoint[] }
    return json.dataPoints ?? []
  }
}

interface DataPoint {
  name?: string
  dataSource?: unknown
  [metric: string]: unknown
}

const toNum = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

// Pull the value field out of a data point's metric object, skipping time/date keys.
function pointValue(point: DataPoint): number | null {
  for (const [k, metric] of Object.entries(point)) {
    if (k === 'name' || k === 'dataSource') continue
    if (!metric || typeof metric !== 'object') continue
    for (const [field, v] of Object.entries(metric as Record<string, unknown>)) {
      if (TIME_KEYS.has(field)) continue
      const n = toNum(v)
      if (n != null) return n
    }
  }
  return null
}

// Epoch ms of a point's most relevant time (don't trust array order).
function pointTime(obj: unknown): number | null {
  if (!obj || typeof obj !== 'object') return null
  const o = obj as Record<string, any>
  for (const k of ['physicalTime', 'endTime', 'startTime']) {
    if (typeof o[k] === 'string') {
      const t = Date.parse(o[k])
      if (Number.isFinite(t)) return t
    }
  }
  if (o.date && typeof o.date.year === 'number') {
    return Date.UTC(o.date.year, (o.date.month ?? 1) - 1, o.date.day ?? 1)
  }
  let best: number | null = null
  for (const [k, v] of Object.entries(o)) {
    // ignore record bookkeeping timestamps (import/sync dates), not the measurement time
    if (k === 'createTime' || k === 'updateTime') continue
    const t = pointTime(v)
    if (t != null && (best == null || t > best)) best = t
  }
  return best
}

function isToday(t: number | null): boolean {
  if (t == null) return false
  const now = new Date()
  const d = new Date(t)
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

// Most recent point by actual timestamp (argmax — order-proof). When multiple
// sources exist, prefer Fitbit so we match the Fitbit/Google Health app.
function latestValue(points: DataPoint[]): Picked {
  const usable = points.filter((p) => pointTime(p) != null && pointValue(p) != null)
  if (!usable.length) return null
  const fit = usable.filter((p) => platformOf(p) === 'FITBIT')
  const pool = fit.length ? fit : usable
  let best = pool[0]
  for (const p of pool) if ((pointTime(p) ?? 0) > (pointTime(best) ?? 0)) best = p
  return { value: pointValue(best)!, source: platformOf(best) }
}

// Latest point whose value falls in [min, max], preferring Fitbit source.
function latestInRange(points: DataPoint[], min: number, max: number): Picked {
  const cand: Array<{ t: number; val: number; plat: string }> = []
  for (const p of points) {
    const t = pointTime(p)
    const val = pointValue(p)
    if (t == null || val == null || val < min || val > max) continue
    cand.push({ t, val, plat: platformOf(p) })
  }
  if (!cand.length) return null
  const fit = cand.filter((c) => c.plat === 'FITBIT')
  const pool = fit.length ? fit : cand
  pool.sort((a, b) => b.t - a.t)
  return { value: Math.round(pool[0].val), source: pool[0].plat }
}

// Latest usable HRV (RMSSD ms): skip non-positive values, prefer Fitbit source.
function pickHrv(points: DataPoint[]): Picked {
  const cand: Array<{ t: number; val: number; plat: string }> = []
  for (const p of points) {
    const t = pointTime(p)
    if (t == null) continue
    const metric = (p.heartRateVariability ?? p.dailyHeartRateVariability) as
      | Record<string, unknown>
      | undefined
    const rmssd = metric?.['rootMeanSquareOfSuccessiveDifferencesMilliseconds']
    const val = toNum(rmssd) ?? pointValue(p)
    if (val != null && val > 0) cand.push({ t, val, plat: platformOf(p) })
  }
  if (!cand.length) return null
  const fit = cand.filter((c) => c.plat === 'FITBIT')
  const pool = fit.length ? fit : cand
  pool.sort((a, b) => b.t - a.t)
  return { value: Math.round(pool[0].val), source: pool[0].plat }
}

// Sum today's points per source platform, then pick ONE source so multiple
// platforms (e.g. Fitbit + Apple HealthKit) don't double-count. Prefer Fitbit.
function sumTodayBySource(points: DataPoint[]): Picked {
  const byPlatform = new Map<string, number>()
  for (const p of points) {
    if (!isToday(pointTime(p))) continue
    const n = pointValue(p)
    if (n == null) continue
    byPlatform.set(platformOf(p), (byPlatform.get(platformOf(p)) ?? 0) + n)
  }
  if (!byPlatform.size) return null
  if (byPlatform.has('FITBIT')) return { value: Math.round(byPlatform.get('FITBIT')!), source: 'FITBIT' }
  let bestPlat = 'UNKNOWN'
  let bestVal = -Infinity
  for (const [plat, val] of byPlatform) if (val > bestVal) ((bestVal = val), (bestPlat = plat))
  return { value: Math.round(bestVal), source: bestPlat }
}

// Filter interval-based types to today (local civil date) so sums don't span days.
function todayIntervalFilter(type: string): string {
  const snake = type.replace(/-/g, '_')
  const d = new Date()
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`
  return `${snake}.interval.civil_start_time >= "${ymd}T00:00:00"`
}
