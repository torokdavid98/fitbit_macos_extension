import { contextBridge, ipcRenderer } from 'electron'
import type { AuthStatus, Stats } from '../main/health/types'

// Mirror of CH in src/main/ipc.ts. Kept inline so preload has no main-process deps.
const CH = {
  getStats: 'health:getStats',
  cached: 'health:cached',
  status: 'health:status',
  login: 'health:login',
  logout: 'health:logout'
} as const

const api = {
  getStats: (): Promise<Stats> => ipcRenderer.invoke(CH.getStats),
  cached: (): Promise<Stats | null> => ipcRenderer.invoke(CH.cached),
  status: (): Promise<AuthStatus> => ipcRenderer.invoke(CH.status),
  login: (): Promise<void> => ipcRenderer.invoke(CH.login),
  logout: (): Promise<void> => ipcRenderer.invoke(CH.logout)
}

contextBridge.exposeInMainWorld('health', api)

export type HealthApi = typeof api
