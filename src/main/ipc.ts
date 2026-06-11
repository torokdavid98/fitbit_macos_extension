import { ipcMain } from 'electron'
import { getProvider } from './health/provider'
import { loadStats, saveStats } from './statsCache'

// Channel names shared with preload.
export const CH = {
  getStats: 'health:getStats',
  cached: 'health:cached',
  status: 'health:status',
  login: 'health:login',
  logout: 'health:logout'
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
}
