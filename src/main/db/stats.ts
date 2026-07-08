import { getDb } from './index'
import type { DailyFocus, HistoryEntry, ProjectTime, RangeFilter, StatsSummary } from '@shared/types'

/** Epoch seconds for the start of the given range, in local time. */
function rangeStart(range: RangeFilter): number {
  if (range === 'all') return 0
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  if (range === 'week') {
    const day = (d.getDay() + 6) % 7 // Monday = 0
    d.setDate(d.getDate() - day)
  } else if (range === 'month') {
    d.setDate(1)
  }
  return Math.floor(d.getTime() / 1000)
}

function localDayString(epochSec: number): string {
  const d = new Date(epochSec * 1000)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const stats = {
  summary(range: RangeFilter): StatsSummary {
    const db = getDb()
    const start = rangeStart(range)
    const focus = db
      .prepare("SELECT COALESCE(SUM(actual_sec), 0) AS s FROM intervals WHERE kind = 'focus' AND started_at >= ?")
      .get(start) as { s: number }
    const completed = db
      .prepare("SELECT COUNT(*) AS n FROM sessions WHERE status = 'completed' AND started_at >= ?")
      .get(start) as { n: number }
    const skipped = db
      .prepare("SELECT COUNT(*) AS n FROM intervals WHERE kind != 'focus' AND skipped = 1 AND started_at >= ?")
      .get(start) as { n: number }

    // Streak: consecutive local days with any focus time, counting back from today
    // (or yesterday, so an unstarted today doesn't break the streak).
    const dayRows = db
      .prepare(
        "SELECT DISTINCT started_at FROM intervals WHERE kind = 'focus' AND actual_sec > 0 ORDER BY started_at DESC"
      )
      .all() as unknown as { started_at: number }[]
    const days = new Set(dayRows.map((r) => localDayString(Number(r.started_at))))
    let streak = 0
    const cursor = new Date()
    cursor.setHours(0, 0, 0, 0)
    const todayStr = localDayString(Math.floor(cursor.getTime() / 1000))
    if (!days.has(todayStr)) cursor.setDate(cursor.getDate() - 1)
    for (;;) {
      const key = localDayString(Math.floor(cursor.getTime() / 1000))
      if (!days.has(key)) break
      streak++
      cursor.setDate(cursor.getDate() - 1)
    }

    return {
      totalFocusSec: Number(focus.s),
      sessionsCompleted: Number(completed.n),
      pausesSkipped: Number(skipped.n),
      currentStreak: streak
    }
  },

  daily(days: number): DailyFocus[] {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    start.setDate(start.getDate() - (days - 1))
    const startSec = Math.floor(start.getTime() / 1000)
    const rows = getDb()
      .prepare("SELECT started_at, actual_sec FROM intervals WHERE kind = 'focus' AND started_at >= ?")
      .all(startSec) as unknown as { started_at: number; actual_sec: number }[]
    const byDay = new Map<string, number>()
    const cursor = new Date(start)
    for (let i = 0; i < days; i++) {
      byDay.set(localDayString(Math.floor(cursor.getTime() / 1000)), 0)
      cursor.setDate(cursor.getDate() + 1)
    }
    for (const r of rows) {
      const key = localDayString(Number(r.started_at))
      byDay.set(key, (byDay.get(key) ?? 0) + Number(r.actual_sec))
    }
    return [...byDay.entries()].map(([day, sec]) => ({ day, focusMin: Math.round(sec / 60) }))
  },

  perProject(range: RangeFilter): ProjectTime[] {
    const start = rangeStart(range)
    return getDb()
      .prepare(
        `SELECT p.id AS projectId, p.name, p.color, COALESCE(SUM(i.actual_sec), 0) AS focusSec
         FROM intervals i
         JOIN sessions s ON s.id = i.session_id
         JOIN projects p ON p.id = s.project_id
         WHERE i.kind = 'focus' AND i.started_at >= ?
         GROUP BY p.id
         HAVING focusSec > 0
         ORDER BY focusSec DESC`
      )
      .all(start) as unknown as ProjectTime[]
  },

  history(limit: number): HistoryEntry[] {
    return getDb()
      .prepare(
        `SELECT s.id, s.started_at AS startedAt, p.name AS projectName, p.color AS projectColor,
                m.name AS methodName, s.status,
                COALESCE((SELECT SUM(actual_sec) FROM intervals i WHERE i.session_id = s.id AND i.kind = 'focus'), 0) AS focusSec
         FROM sessions s
         JOIN projects p ON p.id = s.project_id
         JOIN methods m ON m.id = s.method_id
         WHERE s.status != 'active'
         ORDER BY s.started_at DESC
         LIMIT ?`
      )
      .all(limit) as unknown as HistoryEntry[]
  }
}
