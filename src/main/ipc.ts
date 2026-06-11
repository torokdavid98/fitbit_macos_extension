import { ipcMain, shell } from 'electron'
import { parseGoogleClientJson, saveCreds } from './credStore'
import { getProvider, resetProvider } from './health/provider'
import { setSetting } from './settings'
import { loadStats, saveStats } from './statsCache'

// Channel names shared with preload.
export const CH = {
  getStats: 'health:getStats',
  cached: 'health:cached',
  status: 'health:status',
  login: 'health:login',
  logout: 'health:logout',
  saveCreds: 'setup:saveCreds',
  useDemo: 'setup:useDemo',
  exitDemo: 'setup:exitDemo',
  openUrl: 'shell:openUrl'
} as const

export function registerIpc(): void {
  ipcMain.handle(CH.getStats, async () => {
    const stats = await getProvider().getStats()
    saveStats(stats) // cache last good stats for instant launch
    return stats
  })
  ipcMain.handle(CH.cached, () => loadStats())
  ipcMain.handle(CH.status, () => getProvider().status())
  ipcMain.handle(CH.login, () => getProvider().login())
  ipcMain.handle(CH.logout, () => getProvider().logout())

  // Setup: accept the Google client JSON pasted in-app, store it, go live.
  ipcMain.handle(CH.saveCreds, (_e, text: string) => {
    const creds = parseGoogleClientJson(text)
    if (!creds) return false
    saveCreds(creds)
    setSetting('demo', false)
    resetProvider()
    return true
  })

  ipcMain.handle(CH.useDemo, () => {
    setSetting('demo', true)
    resetProvider()
    return true
  })

  ipcMain.handle(CH.exitDemo, () => {
    setSetting('demo', false)
    resetProvider()
    return true
  })

  ipcMain.handle(CH.openUrl, (_e, url: string) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url)
  })
}
