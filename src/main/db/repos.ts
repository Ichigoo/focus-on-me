import { getDb } from './index'
import type {
  AppSettings,
  Method,
  PauseMessage,
  Project,
  SessionStatus,
  SettingKey,
  IntervalKind
} from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/types'

const now = (): number => Math.floor(Date.now() / 1000)

// ---------- projects ----------

const PROJECT_COLS = `p.id, p.name, p.color, p.archived, p.created_at,
  EXISTS(SELECT 1 FROM sessions s JOIN intervals i ON i.session_id = s.id
         WHERE s.project_id = p.id AND i.kind = 'focus' AND i.actual_sec > 0) AS has_time`

export const projects = {
  list(includeArchived: boolean): Project[] {
    const where = includeArchived ? '' : 'WHERE p.archived = 0'
    return getDb()
      .prepare(`SELECT ${PROJECT_COLS} FROM projects p ${where} ORDER BY p.name COLLATE NOCASE`)
      .all() as unknown as Project[]
  },
  get(id: number): Project | undefined {
    return getDb()
      .prepare(`SELECT ${PROJECT_COLS} FROM projects p WHERE p.id = ?`)
      .get(id) as unknown as Project | undefined
  },
  create(name: string, color: string): Project {
    const res = getDb()
      .prepare('INSERT INTO projects (name, color, created_at) VALUES (?, ?, ?)')
      .run(name.trim(), color, now())
    return this.get(Number(res.lastInsertRowid))!
  },
  update(id: number, name: string, color: string): void {
    getDb().prepare('UPDATE projects SET name = ?, color = ? WHERE id = ?').run(name.trim(), color, id)
  },
  setArchived(id: number, archived: boolean): void {
    getDb().prepare('UPDATE projects SET archived = ? WHERE id = ?').run(archived ? 1 : 0, id)
  },
  remove(id: number): { ok: boolean; reason?: string } {
    const used = getDb().prepare('SELECT COUNT(*) AS n FROM sessions WHERE project_id = ?').get(id) as {
      n: number
    }
    if (Number(used.n) > 0) {
      return { ok: false, reason: 'This project has logged time. Archive it instead.' }
    }
    getDb().prepare('DELETE FROM projects WHERE id = ?').run(id)
    return { ok: true }
  }
}

// ---------- methods ----------

export const methods = {
  list(): Method[] {
    return getDb()
      .prepare('SELECT * FROM methods ORDER BY is_preset DESC, name COLLATE NOCASE')
      .all() as unknown as Method[]
  },
  get(id: number): Method | undefined {
    return getDb().prepare('SELECT * FROM methods WHERE id = ?').get(id) as unknown as Method | undefined
  },
  create(m: Omit<Method, 'id' | 'is_preset'>): Method {
    const res = getDb()
      .prepare(
        `INSERT INTO methods (name, focus_sec, short_pause_sec, long_pause_sec, rounds_before_long, is_preset)
         VALUES (?, ?, ?, ?, ?, 0)`
      )
      .run(m.name.trim(), m.focus_sec, m.short_pause_sec, m.long_pause_sec, m.rounds_before_long)
    return this.get(Number(res.lastInsertRowid))!
  },
  update(m: Omit<Method, 'is_preset'>): void {
    const existing = this.get(m.id)
    if (!existing || existing.is_preset) return
    getDb()
      .prepare(
        `UPDATE methods SET name = ?, focus_sec = ?, short_pause_sec = ?, long_pause_sec = ?, rounds_before_long = ?
         WHERE id = ?`
      )
      .run(m.name.trim(), m.focus_sec, m.short_pause_sec, m.long_pause_sec, m.rounds_before_long, m.id)
  },
  remove(id: number): { ok: boolean; reason?: string } {
    const existing = this.get(id)
    if (!existing) return { ok: true }
    if (existing.is_preset) return { ok: false, reason: 'The Pomodoro preset cannot be deleted.' }
    const used = getDb().prepare('SELECT COUNT(*) AS n FROM sessions WHERE method_id = ?').get(id) as {
      n: number
    }
    if (Number(used.n) > 0) {
      return { ok: false, reason: 'This method was used in past sessions and cannot be deleted.' }
    }
    getDb().prepare('DELETE FROM methods WHERE id = ?').run(id)
    return { ok: true }
  }
}

// ---------- pause messages ----------

export const messages = {
  list(): PauseMessage[] {
    return getDb()
      .prepare('SELECT * FROM pause_messages ORDER BY sort_order')
      .all() as unknown as PauseMessage[]
  },
  listEnabled(): PauseMessage[] {
    return getDb()
      .prepare('SELECT * FROM pause_messages WHERE enabled = 1 ORDER BY sort_order')
      .all() as unknown as PauseMessage[]
  },
  create(text: string): PauseMessage {
    const max = getDb().prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM pause_messages').get() as {
      m: number
    }
    const res = getDb()
      .prepare('INSERT INTO pause_messages (text, enabled, sort_order) VALUES (?, 1, ?)')
      .run(text.trim(), Number(max.m) + 1)
    return getDb()
      .prepare('SELECT * FROM pause_messages WHERE id = ?')
      .get(Number(res.lastInsertRowid)) as unknown as PauseMessage
  },
  update(id: number, text: string): void {
    getDb().prepare('UPDATE pause_messages SET text = ? WHERE id = ?').run(text.trim(), id)
  },
  setEnabled(id: number, enabled: boolean): void {
    getDb().prepare('UPDATE pause_messages SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, id)
  },
  remove(id: number): void {
    getDb().prepare('DELETE FROM pause_messages WHERE id = ?').run(id)
  },
  move(id: number, dir: 'up' | 'down'): void {
    const all = this.list()
    const idx = all.findIndex((m) => m.id === id)
    const swapWith = dir === 'up' ? idx - 1 : idx + 1
    if (idx < 0 || swapWith < 0 || swapWith >= all.length) return
    const db = getDb()
    const stmt = db.prepare('UPDATE pause_messages SET sort_order = ? WHERE id = ?')
    stmt.run(all[swapWith].sort_order, all[idx].id)
    stmt.run(all[idx].sort_order, all[swapWith].id)
  }
}

// ---------- sessions & intervals ----------

export const sessions = {
  create(projectId: number, methodId: number): number {
    const res = getDb()
      .prepare("INSERT INTO sessions (project_id, method_id, started_at, status) VALUES (?, ?, ?, 'active')")
      .run(projectId, methodId, now())
    return Number(res.lastInsertRowid)
  },
  end(id: number, status: SessionStatus): void {
    getDb().prepare('UPDATE sessions SET ended_at = ?, status = ? WHERE id = ?').run(now(), status, id)
  },
  addInterval(
    sessionId: number,
    kind: IntervalKind,
    startedAt: number,
    plannedSec: number,
    actualSec: number,
    skipped: boolean
  ): void {
    getDb()
      .prepare(
        'INSERT INTO intervals (session_id, kind, started_at, planned_sec, actual_sec, skipped) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(sessionId, kind, startedAt, plannedSec, Math.max(0, Math.round(actualSec)), skipped ? 1 : 0)
  },
  /** Mark any sessions left 'active' by a crash as stopped. */
  closeDangling(): void {
    getDb().prepare("UPDATE sessions SET status = 'stopped', ended_at = started_at WHERE status = 'active'").run()
  }
}

// ---------- settings ----------

export const settings = {
  getAll(): AppSettings {
    const rows = getDb().prepare('SELECT key, value FROM settings').all() as unknown as {
      key: string
      value: string
    }[]
    const stored: Record<string, unknown> = {}
    for (const r of rows) {
      try {
        stored[r.key] = JSON.parse(r.value)
      } catch {
        // ignore malformed values, fall back to default
      }
    }
    return { ...DEFAULT_SETTINGS, ...stored } as AppSettings
  },
  set<K extends SettingKey>(key: K, value: AppSettings[K]): void {
    getDb()
      .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(key, JSON.stringify(value))
  }
}
