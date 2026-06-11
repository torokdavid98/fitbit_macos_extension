import { REFRESH_INTERVAL_MS } from '../shared/config'
import type { HealthApi } from '../preload'
import type { Stats } from '../main/health/types'
import { renderCards } from './cards'
import { renderChart } from './chart'
import { renderSleepChart } from './sleepChart'

declare global {
  interface Window {
    health: HealthApi
  }
}

const cards = document.getElementById('cards')!
const chart = document.getElementById('chart')!
const sleepChart = document.getElementById('sleep-chart')!
const updated = document.getElementById('updated')!
const auth = document.getElementById('auth')!
const connect = document.getElementById('connect') as HTMLButtonElement
const refreshBtn = document.getElementById('refresh') as HTMLButtonElement
const logoutBtn = document.getElementById('logout') as HTMLButtonElement
const statusEl = document.getElementById('status')!
const statusLabel = document.getElementById('status-label')!

type Conn = 'connected' | 'offline' | 'error' | 'mock'

function setConnection(state: Conn): void {
  statusEl.className = `status ${state}`
  statusLabel.textContent = {
    connected: 'Connected',
    offline: 'Not connected',
    error: 'Sync error',
    mock: 'Mock data'
  }[state]
}

function relativeTime(ts: number): string {
  const secs = Math.round((Date.now() - ts) / 1000)
  if (secs < 60) return 'just now'
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins}m ago`
  return `${Math.round(mins / 60)}h ago`
}

function showAuth(needed: boolean): void {
  auth.hidden = !needed
  cards.style.display = needed ? 'none' : ''
  chart.style.display = needed ? 'none' : ''
  sleepChart.style.display = needed ? 'none' : ''
  updated.style.display = needed ? 'none' : ''
}

let refreshing = false

async function refresh(): Promise<void> {
  if (refreshing) return
  refreshing = true
  refreshBtn.classList.add('spin')
  try {
    const status = await window.health.status()
    if (status === 'unauthed') {
      showAuth(true)
      setConnection('offline')
      logoutBtn.hidden = true
      return
    }
    showAuth(false)
    // logout only makes sense for a real authed session
    logoutBtn.hidden = status !== 'authed'
    try {
      const stats: Stats = await window.health.getStats()
      renderCards(cards, stats)
      renderChart(chart, stats.heartRateSeries)
      renderSleepChart(sleepChart, stats.sleepStages)
      updated.textContent = relativeTime(stats.updatedAt)
      setConnection(status === 'mock' ? 'mock' : 'connected')
    } catch (err) {
      // token invalid / network: keep last cards, flag the error
      setConnection('error')
      updated.textContent = 'sync failed'
      console.error(err)
      // a failed refresh may have cleared tokens -> re-check auth
      if ((await window.health.status()) === 'unauthed') showAuth(true)
    }
  } finally {
    refreshing = false
    refreshBtn.classList.remove('spin')
  }
}

connect.addEventListener('click', async () => {
  connect.disabled = true
  try {
    await window.health.login()
  } finally {
    connect.disabled = false
  }
  await refresh()
})

refreshBtn.addEventListener('click', refresh)

logoutBtn.addEventListener('click', async () => {
  await window.health.logout()
  await refresh() // -> unauthed -> shows Connect panel
})

// Paint cached stats immediately so launch isn't a blank widget.
async function paintCached(): Promise<void> {
  const cached = await window.health.cached()
  if (cached) {
    renderCards(cards, cached)
    renderChart(chart, cached.heartRateSeries)
    renderSleepChart(sleepChart, cached.sleepStages ?? [])
    updated.textContent = relativeTime(cached.updatedAt)
  }
}

// Refresh whenever the widget is shown (tray toggle focuses the window).
window.addEventListener('focus', refresh)

paintCached().then(refresh)
setInterval(refresh, REFRESH_INTERVAL_MS)
