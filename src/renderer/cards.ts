import type { NumericStatKey, Stats } from '../main/health/types'

interface CardDef {
  key: NumericStatKey
  label: string
  icon: string
  format: (v: number) => string
}

const fmtSleep = (mins: number) => `${Math.floor(mins / 60)}h ${mins % 60}m`

// Lucide-style stroke icons; inherit color via currentColor.
const svg = (inner: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`

const ICON = {
  heartPulse: svg(
    '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"/><path d="M3.22 12H9.5l.5-1.5 2 4 2-6 1.5 3.5h5.27"/>'
  ),
  heart: svg(
    '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"/>'
  ),
  footprints: svg(
    '<path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z"/><path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z"/><path d="M16 17h4"/><path d="M4 13h4"/>'
  ),
  flame: svg(
    '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5Z"/>'
  ),
  waveform: svg('<path d="M2 12h3l2-6 4 14 3-12 2 4h6"/>'),
  moon: svg('<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>'),
  droplet: svg(
    '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7Z"/>'
  )
}

export const CARDS: CardDef[] = [
  { key: 'latestHeartRate', label: 'Heart Rate', icon: ICON.heartPulse, format: (v) => `${v} bpm` },
  { key: 'restingHeartRate', label: 'Resting HR', icon: ICON.heart, format: (v) => `${v} bpm` },
  { key: 'steps', label: 'Steps', icon: ICON.footprints, format: (v) => v.toLocaleString() },
  { key: 'activeCalories', label: 'Active Cal', icon: ICON.flame, format: (v) => `${v} kcal` },
  { key: 'hrv', label: 'HRV', icon: ICON.waveform, format: (v) => `${v} ms` },
  { key: 'sleepMinutes', label: 'Sleep', icon: ICON.moon, format: fmtSleep },
  { key: 'spo2', label: 'SpO₂', icon: ICON.droplet, format: (v) => `${v}%` }
]

// Map a raw platform id to a friendly source name.
const SOURCE_LABELS: Record<string, string> = {
  FITBIT: 'Fitbit',
  HEALTH_KIT: 'Apple Health',
  GOOGLE_FIT: 'Google Fit',
  PIXEL_WATCH: 'Pixel Watch',
  MOCK: 'Demo'
}

function sourceLabel(platform: string | undefined): string {
  if (!platform) return ''
  return SOURCE_LABELS[platform] ?? platform.replace(/_/g, ' ').toLowerCase()
}

export function renderCards(container: HTMLElement, stats: Stats): void {
  container.innerHTML = CARDS.map((c) => {
    const raw = stats[c.key]
    const empty = raw == null
    const value = empty ? '—' : c.format(raw)
    const src = empty ? '' : sourceLabel(stats.sources?.[c.key])
    return `
      <div class="card${empty ? ' card--empty' : ''}">
        <span class="card-icon">${c.icon}</span>
        <span class="card-value">${value}</span>
        <span class="card-label">${empty ? 'No data' : c.label}</span>
        ${src ? `<span class="card-source">${src}</span>` : ''}
      </div>`
  }).join('')
}
