import { getDb } from './index'
import { localDayString } from './stats'
import type { Task, TaskDayStatus, TaskInput, TaskWithStatus } from '@shared/types'

const now = (): number => Math.floor(Date.now() / 1000)

function validateInput(input: TaskInput): void {
  if (input.schedule_kind === 'weekly' && input.weekdays === 0) {
    throw new Error('Select at least one weekday')
  }
  if (input.schedule_kind === 'once' && !input.once_date) {
    throw new Error('Choose a date for a one-time task')
  }
}

/** Strict schedule match for a given local day — no overdue carry-forward. */
function isScheduledOn(task: Task, day: string): boolean {
  if (day < task.created_day) return false
  if (task.schedule_kind === 'daily') return true
  if (task.schedule_kind === 'weekly') {
    const dow = new Date(day + 'T00:00:00').getDay()
    return (task.weekdays & (1 << dow)) !== 0
  }
  return task.once_date === day
}

function getCompletion(taskId: number, day: string): { status: TaskDayStatus } | undefined {
  return getDb().prepare('SELECT status FROM task_completions WHERE task_id = ? AND day = ?').get(taskId, day) as
    | { status: TaskDayStatus }
    | undefined
}

/** Computed lazily at query time from completions + schedule — a gap in completions is the reset. */
function computeStreak(task: Task, uptoDay: string): number {
  const rows = getDb()
    .prepare('SELECT day, status FROM task_completions WHERE task_id = ?')
    .all(task.id) as unknown as { day: string; status: TaskDayStatus }[]
  const byDay = new Map(rows.map((r) => [r.day, r.status]))

  let streak = 0
  const cursor = new Date(uptoDay + 'T00:00:00')
  for (let i = 0; i < 3650; i++) {
    const day = localDayString(Math.floor(cursor.getTime() / 1000))
    if (day < task.created_day) break
    if (isScheduledOn(task, day)) {
      const status = byDay.get(day)
      if (status === 'done') {
        streak++
      } else if (status === 'ignored') {
        break
      } else if (i !== 0) {
        // missing on a past scheduled day (not the queried day itself) breaks the streak
        break
      }
      // i === 0 and unmarked: tolerate without counting or breaking (same as stats.ts today-tolerance)
    }
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export const tasksRepo = {
  /** All tasks with status/streak anchored to their own canonical day (today, or once_date for one-time tasks). */
  list(): TaskWithStatus[] {
    const today = localDayString(now())
    const allTasks = getDb()
      .prepare('SELECT * FROM tasks WHERE archived = 0 ORDER BY name COLLATE NOCASE')
      .all() as unknown as Task[]
    return allTasks.map((task) => {
      const completionDay = task.schedule_kind === 'once' && task.once_date ? task.once_date : today
      const completion = getCompletion(task.id, completionDay)
      const status: TaskDayStatus | 'pending' = completion ? completion.status : 'pending'
      const overdue = task.schedule_kind === 'once' && !!task.once_date && task.once_date < today && status === 'pending'
      return { ...task, status, streak: computeStreak(task, today), overdue: overdue || undefined }
    })
  },

  get(id: number): Task | undefined {
    return getDb().prepare('SELECT * FROM tasks WHERE id = ?').get(id) as unknown as Task | undefined
  },

  create(input: TaskInput): Task {
    validateInput(input)
    const day = localDayString(now())
    const res = getDb()
      .prepare(
        `INSERT INTO tasks (name, schedule_kind, weekdays, once_date, time_hhmm, created_at, created_day)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(input.name.trim(), input.schedule_kind, input.weekdays, input.once_date, input.time_hhmm, now(), day)
    return this.get(Number(res.lastInsertRowid))!
  },

  update(id: number, input: TaskInput): void {
    validateInput(input)
    getDb()
      .prepare(
        `UPDATE tasks SET name = ?, schedule_kind = ?, weekdays = ?, once_date = ?, time_hhmm = ? WHERE id = ?`
      )
      .run(input.name.trim(), input.schedule_kind, input.weekdays, input.once_date, input.time_hhmm, id)
  },

  remove(id: number): void {
    getDb().prepare('DELETE FROM tasks WHERE id = ?').run(id)
  },

  listForDay(day: string): TaskWithStatus[] {
    const allTasks = getDb().prepare('SELECT * FROM tasks WHERE archived = 0').all() as unknown as Task[]
    const results: TaskWithStatus[] = []

    for (const task of allTasks) {
      if (day < task.created_day) continue

      let scheduled = false
      let overdue = false
      let completionDay = day

      if (task.schedule_kind === 'once') {
        completionDay = task.once_date ?? day
        if (task.once_date === day) {
          scheduled = true
        } else if (task.once_date && task.once_date < day) {
          const completion = getCompletion(task.id, completionDay)
          if (!completion) {
            scheduled = true
            overdue = true
          }
        }
      } else {
        scheduled = isScheduledOn(task, day)
      }

      if (!scheduled) continue

      const completion = getCompletion(task.id, completionDay)
      const status: TaskDayStatus | 'pending' = completion ? completion.status : 'pending'
      const streak = computeStreak(task, day)
      results.push({ ...task, status, streak, overdue: overdue || undefined })
    }

    results.sort((a, b) => {
      if (a.time_hhmm && b.time_hhmm) return a.time_hhmm.localeCompare(b.time_hhmm)
      if (a.time_hhmm) return -1
      if (b.time_hhmm) return 1
      return a.name.localeCompare(b.name)
    })
    return results
  },

  setStatus(taskId: number, day: string, status: TaskDayStatus | null): TaskWithStatus[] {
    const task = this.get(taskId)
    if (task) {
      const completionDay = task.schedule_kind === 'once' && task.once_date ? task.once_date : day
      if (status === null) {
        getDb().prepare('DELETE FROM task_completions WHERE task_id = ? AND day = ?').run(taskId, completionDay)
      } else {
        getDb()
          .prepare(
            `INSERT INTO task_completions (task_id, day, status, marked_at) VALUES (?, ?, ?, ?)
             ON CONFLICT(task_id, day) DO UPDATE SET status = excluded.status, marked_at = excluded.marked_at`
          )
          .run(taskId, completionDay, status, now())
      }
    }
    return this.listForDay(day)
  }
}
