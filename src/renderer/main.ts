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
const setup = document.getElementById('setup')!
const connect = document.getElementById('connect') as HTMLButtonElement
const refreshBtn = document.getElementById('refresh') as HTMLButtonElement
const refreshIc = document.getElementById('refresh-ic')!
const logoutBtn = document.getElementById('logout') as HTMLButtonElement
const statusEl = document.getElementById('status')!
const statusLabel = document.getElementById('status-label')!
const credsJson = document.getElementById('creds-json') as HTMLTextAreaElement
const saveCredsBtn = document.getElementById('save-creds') as HTMLButtonElement
const useDemoBtn = document.getElementById('use-demo') as HTMLButtonElement
const openConsoleBtn = document.getElementById('open-console') as HTMLButtonElement
const setupErr = document.getElementById('setup-err')!

type Conn = 'connected' | 'offline' | 'error' | 'mock'
type Screen = 'data' | 'auth' | 'setup'

const dataEls = [cards, chart, sleepChart, updated]

function setScreen(screen: Screen): void {
  setup.hidden = screen !== 'setup'
  auth.hidden = screen !== 'auth'
  for (const el of dataEls) (el as HTMLElement).style.display = screen === 'data' ? '' : 'none'
}

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

let refreshing = false

async function refresh(): Promise<void> {
  if (refreshing) return
  refreshing = true
  refreshIc.classList.add('spin')
  try {
    const status = await window.health.status()
    if (status === 'unconfigured') {
      setScreen('setup')
      setConnection('offline')
      logoutBtn.hidden = true
      return
    }
    if (status === 'unauthed') {
      setScreen('auth')
      setConnection('offline')
      logoutBtn.hidden = true
      return
    }
    setScreen('data')
    // show the button for authed (log out) and mock (exit demo)
    logoutBtn.hidden = status !== 'authed' && status !== 'mock'
    logoutBtn.title = status === 'mock' ? 'Exit demo' : 'Log out'
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
      if ((await window.health.status()) === 'unauthed') setScreen('auth')
    }
  } finally {
    refreshing = false
    refreshIc.classList.remove('spin')
  }
}

connect.addEventListener('click', async () => {
  // re-clicking restarts the flow (the main process cancels the prior attempt)
  connect.textContent = 'Waiting for browser… (click to retry)'
  try {
    await window.health.login()
    await refresh()
  } catch (err) {
    console.error(err) // timeout / closed window / denied
  }
  if (!auth.hidden) connect.textContent = 'Connect Google Health'
})

refreshBtn.addEventListener('click', refresh)

openConsoleBtn.addEventListener('click', () =>
  window.health.openUrl('https://console.cloud.google.com/')
)

saveCredsBtn.addEventListener('click', async () => {
  setupErr.hidden = true
  const ok = await window.health.saveCreds(credsJson.value.trim())
  if (!ok) {
    setupErr.hidden = false
    return
  }
  credsJson.value = ''
  await refresh() // -> unauthed -> Connect screen
})

useDemoBtn.addEventListener('click', async () => {
  await window.health.useDemo()
  await refresh()
})

logoutBtn.addEventListener('click', async () => {
  // in demo mode this exits demo (-> setup); otherwise it logs out (-> connect)
  if ((await window.health.status()) === 'mock') {
    await window.health.exitDemo()
  } else {
    await window.health.logout()
  }
  await refresh()
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
