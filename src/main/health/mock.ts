import type { AuthStatus, HealthProvider, SleepStage, Stats } from './types'

// Realistic-looking fake stats. Values drift a little on each call so the UI
// visibly updates on refresh. No network, no auth.
export class MockProvider implements HealthProvider {
  private base = {
    steps: 6500,
    latestHeartRate: 72,
    restingHeartRate: 58,
    hrv: 42,
    sleepMinutes: 7 * 60 + 20,
    spo2: 97,
    activeCalories: 480
  }

  async getStats(): Promise<Stats> {
    const jitter = (n: number, spread: number) =>
      Math.round(n + (Math.sin(Date.now() / 60000 + n) * spread))
    return {
      steps: jitter(this.base.steps, 400),
      latestHeartRate: jitter(this.base.latestHeartRate, 8),
      restingHeartRate: jitter(this.base.restingHeartRate, 3),
      hrv: jitter(this.base.hrv, 4),
      sleepMinutes: jitter(this.base.sleepMinutes, 15),
      spo2: Math.min(100, jitter(this.base.spo2, 1)),
      activeCalories: jitter(this.base.activeCalories, 40),
      heartRateSeries: this.fakeSeries(),
      sleepStages: this.fakeStages(),
      sources: {
        steps: 'MOCK',
        latestHeartRate: 'MOCK',
        restingHeartRate: 'MOCK',
        hrv: 'MOCK',
        sleepMinutes: 'MOCK',
        spo2: 'MOCK',
        activeCalories: 'MOCK'
      },
      updatedAt: Date.now()
    }
  }

  // A plausible ~7h20m night of fake sleep stages, ending this morning.
  private fakeStages(): SleepStage[] {
    const pattern: Array<[string, number]> = [
      ['LIGHT', 25],
      ['DEEP', 45],
      ['LIGHT', 30],
      ['REM', 25],
      ['AWAKE', 8],
      ['LIGHT', 40],
      ['DEEP', 35],
      ['REM', 30],
      ['LIGHT', 50],
      ['REM', 40],
      ['LIGHT', 32]
    ]
    const totalMin = pattern.reduce((s, [, m]) => s + m, 0)
    let cursor = Date.now() - 2 * 60 * 60 * 1000 - totalMin * 60 * 1000 // woke ~2h ago
    const out: SleepStage[] = []
    for (const [type, mins] of pattern) {
      const start = cursor
      const end = cursor + mins * 60 * 1000
      out.push({ type, start, end })
      cursor = end
    }
    return out
  }

  // ~3h of fake HR samples every 5 min, ending now.
  private fakeSeries(): Array<{ t: number; bpm: number }> {
    const now = Date.now()
    const out: Array<{ t: number; bpm: number }> = []
    for (let i = 36; i >= 0; i--) {
      const t = now - i * 5 * 60 * 1000
      const bpm = Math.round(70 + Math.sin(i / 3) * 10 + Math.sin(i) * 4)
      out.push({ t, bpm })
    }
    return out
  }

  async status(): Promise<AuthStatus> {
    return 'mock'
  }

  async login(): Promise<void> {
    /* no-op for mock */
  }

  async logout(): Promise<void> {
    /* no-op for mock */
  }
}
