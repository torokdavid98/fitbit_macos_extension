import type { Stats } from '../main/health/types'

// Tiny dependency-free SVG sparkline of today's heart rate.
export function renderChart(container: HTMLElement, series: Stats['heartRateSeries']): void {
  if (!series || series.length < 2) {
    container.innerHTML = `
      <div class="chart-head"><span>Heart rate today</span></div>
      <div class="chart-empty">No heart-rate data today</div>`
    return
  }

  const w = 288
  const h = 64
  const pad = 4
  const bpms = series.map((s) => s.bpm)
  const min = Math.min(...bpms)
  const max = Math.max(...bpms)
  const range = max - min || 1
  const n = series.length

  const x = (i: number) => pad + (i / (n - 1)) * (w - 2 * pad)
  const y = (b: number) => pad + (1 - (b - min) / range) * (h - 2 * pad)

  const line = series.map((s, i) => `${x(i).toFixed(1)},${y(s.bpm).toFixed(1)}`).join(' ')
  const area = `${pad.toFixed(1)},${(h - pad).toFixed(1)} ${line} ${(w - pad).toFixed(1)},${(
    h - pad
  ).toFixed(1)}`
  const last = series[series.length - 1].bpm

  container.innerHTML = `
    <div class="chart-head">
      <span>Heart rate today</span>
      <span class="chart-range">${min}–${max} bpm</span>
    </div>
    <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" class="hr-svg">
      <polygon points="${area}" class="hr-area" />
      <polyline points="${line}" class="hr-line" />
      <circle cx="${x(n - 1).toFixed(1)}" cy="${y(last).toFixed(1)}" r="2.5" class="hr-dot" />
    </svg>`
}
