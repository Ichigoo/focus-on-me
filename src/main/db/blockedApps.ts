import { basename } from 'path'
import { getDb } from './index'
import type { BlockedApp } from '@shared/types'

const now = (): number => Math.floor(Date.now() / 1000)

// Never allow killing these — system-critical or the app itself.
const DENYLIST = new Set([
  'explorer.exe',
  'csrss.exe',
  'winlogon.exe',
  'svchost.exe',
  'dwm.exe',
  'lsass.exe',
  'smss.exe',
  'services.exe',
  'wininit.exe',
  'taskmgr.exe',
  'system',
  basename(process.execPath).toLowerCase()
])

export function normalizeExe(input: string): string {
  let exe = input.trim().toLowerCase()
  if (!exe) return ''
  if (!exe.endsWith('.exe')) exe += '.exe'
  return exe
}

export const blockedApps = {
  list(): BlockedApp[] {
    return getDb()
      .prepare('SELECT * FROM blocked_apps ORDER BY name COLLATE NOCASE')
      .all() as unknown as BlockedApp[]
  },

  listEnabledExes(): string[] {
    const rows = getDb()
      .prepare('SELECT exe FROM blocked_apps WHERE enabled = 1')
      .all() as unknown as { exe: string }[]
    return rows.map((r) => r.exe.toLowerCase())
  },

  add(name: string, exe: string): { ok: boolean; reason?: string } {
    const normalized = normalizeExe(exe)
    if (!normalized) return { ok: false, reason: 'Enter an executable name' }
    if (DENYLIST.has(normalized)) {
      return { ok: false, reason: 'This is a system process and cannot be blocked' }
    }
    const exists = getDb().prepare('SELECT id FROM blocked_apps WHERE exe = ? COLLATE NOCASE').get(normalized)
    if (exists) return { ok: false, reason: 'This app is already in the list' }
    getDb()
      .prepare('INSERT INTO blocked_apps (name, exe, enabled, created_at) VALUES (?, ?, 1, ?)')
      .run(name.trim() || normalized.replace(/\.exe$/, ''), normalized, now())
    return { ok: true }
  },

  setEnabled(id: number, enabled: boolean): void {
    getDb().prepare('UPDATE blocked_apps SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, id)
  },

  remove(id: number): void {
    getDb().prepare('DELETE FROM blocked_apps WHERE id = ?').run(id)
  }
}
