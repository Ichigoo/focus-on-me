import { getDb } from './index'
import type {
  DailyFocus,
  HistoryEntry,
  ProjectTime,
  RangeFilter,
  StatsSummary,
  StatsSummaryExtended,
  StatsTrend
} from '@shared/types'

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

export function localDayString(epochSec: number): string {
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

  /**
   * Summary plus derived metrics for the analytics screens.
   *
   * Productivity Score = 100 × (0.4·min(1, focusSec / 4h·days) +
   * 0.3·sessionCompletionRate + 0.3·taskCompletionRate). Components with no
   * data are excluded and the remaining weights renormalized; null when
   * nothing at all happened in the range.
   */
  summaryExtended(range: RangeFilter): StatsSummaryExtended {
    const db = getDb()
    const base = this.summary(range)
    const start = rangeStart(range)

    const sessionRow = db
      .prepare(
        "SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS done FROM sessions WHERE status != 'active' AND started_at >= ?"
      )
      .get(start) as { total: number; done: number | null }
    const totalSessions = Number(sessionRow.total)
    const avgSessionSec = totalSessions > 0 ? Math.round(base.totalFocusSec / totalSessions) : 0

    // Best streak: longest consecutive-day run across all focus days.
    const dayRows = db
      .prepare(
        "SELECT DISTINCT started_at FROM intervals WHERE kind = 'focus' AND actual_sec > 0 ORDER BY started_at"
      )
      .all() as unknown as { started_at: number }[]
    const sortedDays = [...new Set(dayRows.map((r) => localDayString(Number(r.started_at))))].sort()
    let bestStreak = 0
    let run = 0
    let prev: string | null = null
    for (const day of sortedDays) {
      if (prev) {
        const next = new Date(`${prev}T00:00:00`)
        next.setDate(next.getDate() + 1)
        run = localDayString(Math.floor(next.getTime() / 1000)) === day ? run + 1 : 1
      } else {
        run = 1
      }
      bestStreak = Math.max(bestStreak, run)
      prev = day
    }

    // Task completion within the range (by completion day).
    const startDay = localDayString(start === 0 ? 0 : start)
    const taskRow = db
      .prepare(
        "SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done FROM task_completions WHERE day >= ?"
      )
      .get(start === 0 ? '0000-00-00' : startDay) as { total: number; done: number | null }
    const tasksScheduled = Number(taskRow.total)
    const tasksDone = Number(taskRow.done ?? 0)

    // Productivity score
    const daysInRange =
      range === 'today' ? 1 : range === 'week' ? 7 : range === 'month' ? new Date().getDate() : sortedDays.length || 1
    const parts: { weight: number; value: number }[] = []
    if (base.totalFocusSec > 0 || totalSessions > 0) {
      parts.push({ weight: 0.4, value: Math.min(1, base.totalFocusSec / (4 * 3600 * daysInRange)) })
    }
    if (totalSessions > 0) {
      parts.push({ weight: 0.3, value: Number(sessionRow.done ?? 0) / totalSessions })
    }
    if (tasksScheduled > 0) {
      parts.push({ weight: 0.3, value: tasksDone / tasksScheduled })
    }
    const totalWeight = parts.reduce((s, p) => s + p.weight, 0)
    const productivityScore =
      totalWeight > 0
        ? Math.round((parts.reduce((s, p) => s + p.weight * p.value, 0) / totalWeight) * 100)
        : null

    return { ...base, avgSessionSec, bestStreak, productivityScore, tasksDone, tasksScheduled }
  },

  /** Focus/session totals for the range vs the immediately preceding equal-length period. */
  trend(range: RangeFilter): StatsTrend {
    const db = getDb()
    const start = rangeStart(range)
    const nowSec = Math.floor(Date.now() / 1000)
    const prevStart = range === 'all' ? 0 : start - Math.max(1, nowSec - start)

    function window(from: number, to: number): { focus: number; sessions: number } {
      const f = db
        .prepare(
          "SELECT COALESCE(SUM(actual_sec), 0) AS s FROM intervals WHERE kind = 'focus' AND started_at >= ? AND started_at < ?"
        )
        .get(from, to) as { s: number }
      const c = db
        .prepare("SELECT COUNT(*) AS n FROM sessions WHERE status != 'active' AND started_at >= ? AND started_at < ?")
        .get(from, to) as { n: number }
      return { focus: Number(f.s), sessions: Number(c.n) }
    }

    const current = window(start, nowSec + 1)
    const previous = range === 'all' ? { focus: 0, sessions: 0 } : window(prevStart, start)
    return {
      focusSecCurrent: current.focus,
      focusSecPrevious: previous.focus,
      sessionsCurrent: current.sessions,
      sessionsPrevious: previous.sessions
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
