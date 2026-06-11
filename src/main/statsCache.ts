import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type { Stats } from './health/types'

// Last good stats, cached to disk so the widget can paint instantly on launch
// (before the network round-trip completes).
function file(): string {
  return join(app.getPath('userData'), 'last-stats.json')
}

export function saveStats(stats: Stats): void {
  try {
    writeFileSync(file(), JSON.stringify(stats))
  } catch {
    /* non-fatal */
  }
}

export function loadStats(): Stats | null {
  try {
    const path = file()
    if (!existsSync(path)) return null
    return JSON.parse(readFileSync(path, 'utf8')) as Stats
  } catch {
    return null
  }
}
