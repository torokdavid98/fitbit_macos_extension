import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

// Small plain-JSON settings (not secret). Currently just the demo-data toggle.
interface Settings {
  demo?: boolean
}

function file(): string {
  return join(app.getPath('userData'), 'settings.json')
}

export function getSettings(): Settings {
  try {
    const path = file()
    if (!existsSync(path)) return {}
    return JSON.parse(readFileSync(path, 'utf8')) as Settings
  } catch {
    return {}
  }
}

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
  const next = { ...getSettings(), [key]: value }
  try {
    writeFileSync(file(), JSON.stringify(next))
  } catch {
    /* non-fatal */
  }
}
