import type { SleepStage } from '../main/health/types'

// Stage colors (deep -> light gradient feel, REM teal, awake muted).
const STAGE_COLOR: Record<string, string> = {
  DEEP: '#3b4cca',
  LIGHT: '#5e9eff',
  REM: '#2bc4b8',
  AWAKE: '#9aa0a6'
}

const order = ['AWAKE', 'REM', 'LIGHT', 'DEEP'] // vertical lanes, awake on top

const fmtClock = (t: number): string => {
  const d = new Date(t)
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

// Hypnogram: each stage drawn as a block at its lane height across the night.
export function renderSleepChart(container: HTMLElement, stages: SleepStage[]): void {
  if (!stages || stages.length < 2) {
    container.innerHTML = ''
    return
  }

  const w = 288
  const h = 56
  const start = stages[0].start
  const end = stages[stages.length - 1].end
  const span = end - start || 1
  const laneH = h / order.length

  const x = (t: number) => ((t - start) / span) * w

  const blocks = stages
    .map((s) => {
      const lane = order.indexOf(s.type)
      const li = lane < 0 ? order.indexOf('LIGHT') : lane
      const bx = x(s.start)
      const bw = Math.max(0.5, x(s.end) - x(s.start))
      const color = STAGE_COLOR[s.type] ?? STAGE_COLOR.LIGHT
      return `<rect x="${bx.toFixed(1)}" y="${(li * laneH).toFixed(1)}" width="${bw.toFixed(
        1
      )}" height="${(laneH - 2).toFixed(1)}" rx="2" fill="${color}" />`
    })
    .join('')

  // total minutes per stage for the legend
  const totals = new Map<string, number>()
  for (const s of stages) {
    totals.set(s.type, (totals.get(s.type) ?? 0) + (s.end - s.start))
  }
  const legend = order
    .filter((t) => totals.has(t))
    .map((t) => {
      const mins = Math.round((totals.get(t) ?? 0) / 60000)
      return `<span class="sleep-leg"><i style="background:${STAGE_COLOR[t]}"></i>${t[0]}${t
        .slice(1)
        .toLowerCase()} ${mins}m</span>`
    })
    .join('')

  container.innerHTML = `
    <div class="chart-head">
      <span>Sleep stages</span>
      <span class="chart-range">${fmtClock(start)}–${fmtClock(end)}</span>
    </div>
    <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" class="sleep-svg">${blocks}</svg>
    <div class="sleep-legend">${legend}</div>`
}
