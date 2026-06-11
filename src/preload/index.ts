import { contextBridge, ipcRenderer } from 'electron'
import type { AuthStatus, Stats } from '../main/health/types'

// Mirror of CH in src/main/ipc.ts. Kept inline so preload has no main-process deps.
const CH = {
  getStats: 'health:getStats',
  cached: 'health:cached',
  status: 'health:status',
  login: 'health:login',
  logout: 'health:logout',
  saveCreds: 'setup:saveCreds',
  useDemo: 'setup:useDemo',
  openUrl: 'shell:openUrl'
} as const

const api = {
  getStats: (): Promise<Stats> => ipcRenderer.invoke(CH.getStats),
  cached: (): Promise<Stats | null> => ipcRenderer.invoke(CH.cached),
  status: (): Promise<AuthStatus> => ipcRenderer.invoke(CH.status),
  login: (): Promise<void> => ipcRenderer.invoke(CH.login),
  logout: (): Promise<void> => ipcRenderer.invoke(CH.logout),
  saveCreds: (text: string): Promise<boolean> => ipcRenderer.invoke(CH.saveCreds, text),
  useDemo: (): Promise<boolean> => ipcRenderer.invoke(CH.useDemo),
  openUrl: (url: string): Promise<void> => ipcRenderer.invoke(CH.openUrl, url)
}

contextBridge.exposeInMainWorld('health', api)

export type HealthApi = typeof api
